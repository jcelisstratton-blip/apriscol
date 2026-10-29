"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { cambioDeAjuste } from "@/lib/inventario";
import { MOTIVOS_AJUSTE_ALIMENTO, RUBROS_ALIMENTO, aKg, compraEnKg, type FilaAlimento, type MotivoAjusteAlimento } from "@/lib/inventario-alimento";
import { decimal, esRepetido, noFutura, opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string; /** Se guardó y la pantalla sigue («Guardar y anotar otro»). */ guardado?: boolean } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

const SIN_PERMISO = "No tienes permiso para mover el inventario de alimento de esta finca.";
const SOLO_GESTION = "Solo el propietario o el administrador puede contar, ajustar o cambiar el peso del alimento.";

/** El alimento, con su peso por unidad (lo pone el servidor: el navegador nunca elige cuánto pesa un bulto). */
async function cargarAlimento(supabase: Cliente, fincaId: string, id: string) {
  const { data } = await supabase
    .from("finca_productos")
    .select("id, nombre, unidad, kg_por_unidad, rubro")
    .eq("id", id)
    .eq("finca_id", fincaId)
    .eq("tipo", "compra")
    .maybeSingle();
  return data && data.rubro && (RUBROS_ALIMENTO as readonly string[]).includes(data.rubro) ? data : null;
}

function refrescar(productoId: string) {
  revalidatePath("/inventario");
  revalidatePath(`/inventario/alimento/${productoId}`);
  revalidatePath("/");
}

/** Las existencias de un alimento, en kg y con el tipo de unidad, para comparar un conteo. */
async function existenciasDe(supabase: Cliente, fincaId: string, productoId: string): Promise<FilaAlimento | null> {
  const { data } = await supabase.rpc("inventario_alimento", { p_finca: fincaId, p_hoy: hoyBogota() });
  return ((data ?? []) as FilaAlimento[]).find((f) => f.producto_id === productoId) ?? null;
}

// ───────────────────────── Peso de cada unidad ─────────────────────────
const esquemaPeso = z.object({
  producto_id: z.uuid(),
  kg: decimal(z.number("Escribe un número en el peso.").gt(0, "El peso debe ser mayor que cero.").max(100_000, "Ese peso es demasiado grande.")),
});

/** Cuánto pesa cada bulto o paca de un alimento. Cambiarlo recalcula las compras anteriores. */
export async function guardarPesoUnidad(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol) || !puedeEscribir(rol, "nutricion", finca.plan)) return { error: SOLO_GESTION };
  const datos = esquemaPeso.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const alimento = await cargarAlimento(supabase, finca.id, datos.data.producto_id);
  if (!alimento) return { error: "No encontramos ese alimento." };
  const { error } = await supabase.from("finca_productos").update({ kg_por_unidad: datos.data.kg ?? null }).eq("id", alimento.id).eq("finca_id", finca.id);
  if (error) return { error: mensajeAmigable(error.message) };
  refrescar(alimento.id);
  redirect(`/inventario/alimento/${alimento.id}?guardado=1`);
}

// ───────────────────────── Salidas: lo que se le dio de comer al hato ─────────────────────────
const esquemaSalida = z.object({
  producto_id: z.uuid("Elige el alimento."),
  cantidad: decimal(z.number("Escribe cuánto se dio.").gt(0, "Escribe cuánto se dio (más de 0).").max(1_000_000, "Ese número es demasiado grande.")),
  unidad: opcional(z.enum(["kg", "unidad"])),
  fecha: z.iso.date("Indica la fecha."),
  destino: opcional(z.string().max(60)),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  client_request_id: opcional(z.uuid()),
});

/**
 * Anota lo que se dio de comer. Lo hace quien da el alimento (el ordeñador, el administrador, el propietario) en segundos: alimento, cuánto (en kg o en bultos) y
 * la fecha; el destino (un corral o un lote de ceba) es opcional. Con «Guardar y anotar otro» el formulario sigue abierto para el siguiente alimento.
 */
export async function guardarSalida(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "nutricion", finca.plan)) return { error: SIN_PERMISO };
  const datos = esquemaSalida.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (d.cantidad === undefined) return { error: "Escribe cuánto se dio." };
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };

  const supabase = await crearClienteServidor();
  const alimento = await cargarAlimento(supabase, finca.id, d.producto_id);
  if (!alimento) return { error: "No encontramos ese alimento." };
  const enUnidad = d.unidad === "unidad";
  if (enUnidad && (compraEnKg(alimento.unidad) || !alimento.kg_por_unidad)) return { error: "Este alimento todavía no tiene el peso de cada unidad. Escribe la cantidad en kg." };
  const kg = aKg(d.cantidad, enUnidad ? (alimento.kg_por_unidad ?? 1) : 1);
  if (kg <= 0) return { error: "La cantidad es demasiado pequeña." };

  // El destino (corral o lote de ceba) se comprueba contra los de la finca; solo lo ve quien puede ver Corrales o Carne.
  let ubicacionId: string | null = null;
  let loteId: string | null = null;
  if (d.destino) {
    const [tipo, id] = d.destino.split(":");
    if (!z.uuid().safeParse(id).success || (tipo !== "ubicacion" && tipo !== "lote")) return { error: "Ese destino no es válido." };
    if (tipo === "ubicacion") {
      const { data } = await supabase.from("ubicaciones").select("id").eq("id", id).eq("finca_id", finca.id).maybeSingle();
      if (!data) return { error: "No encontramos ese corral." };
      ubicacionId = data.id;
    } else {
      const { data } = await supabase.from("lotes_ceba").select("id").eq("id", id).eq("finca_id", finca.id).maybeSingle();
      if (!data) return { error: "No encontramos ese lote." };
      loteId = data.id;
    }
  }

  const { error } = await supabase.from("inventario_alimento_movimientos").insert({
    finca_id: finca.id,
    producto_id: alimento.id,
    tipo: "salida",
    fecha: d.fecha,
    cantidad: kg,
    ubicacion_id: ubicacionId,
    lote_id: loteId,
    observaciones: d.observaciones ?? null,
    client_request_id: d.client_request_id ?? null,
  });
  // Doble toque: la misma solicitud ya se guardó.
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  refrescar(alimento.id);
  if (form.get("seguir") === "1") return { guardado: true };
  redirect(`/inventario/alimento/${alimento.id}?guardado=1`);
}

// ───────────────────────── Conteo y ajustes ─────────────────────────
const esquemaConteo = z.object({
  producto_id: z.uuid(),
  motivo: z.enum(MOTIVOS_AJUSTE_ALIMENTO as [string, ...string[]], "Elige el motivo del ajuste."),
  cantidad: decimal(z.number("Escribe la cantidad.").min(0, "La cantidad no puede ser negativa.").max(1_000_000, "Ese número es demasiado grande.")),
  unidad: opcional(z.enum(["kg", "unidad"])),
  fecha: z.iso.date("Indica la fecha."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
});

/**
 * El primer conteo de un alimento (la apertura: cuánto hay hoy) y los ajustes posteriores: «conteo físico» (lo que contaste frente a lo que decía la app) o una
 * baja por pérdida o daño. Solo propietario y administrador.
 */
export async function guardarConteoAlimento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol) || !puedeEscribir(rol, "nutricion", finca.plan)) return { error: SOLO_GESTION };
  const datos = esquemaConteo.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (d.cantidad === undefined) return { error: "Escribe la cantidad." };
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  const motivo = d.motivo as MotivoAjusteAlimento;
  if (motivo === "otro" && !d.observaciones) return { error: "Cuéntanos el motivo en las observaciones." };
  if (motivo !== "conteo" && d.cantidad === 0) return { error: "Escribe cuánto se descarta (más de 0)." };

  const supabase = await crearClienteServidor();
  const alimento = await cargarAlimento(supabase, finca.id, d.producto_id);
  if (!alimento) return { error: "No encontramos ese alimento." };
  const enUnidad = d.unidad === "unidad";
  if (enUnidad && (compraEnKg(alimento.unidad) || !alimento.kg_por_unidad)) return { error: "Este alimento todavía no tiene el peso de cada unidad. Escribe la cantidad en kg." };
  const kg = aKg(d.cantidad, enUnidad ? (alimento.kg_por_unidad ?? 1) : 1);

  const existencias = await existenciasDe(supabase, finca.id, alimento.id);
  if (!existencias) return { error: "No encontramos ese alimento." };

  if (existencias.desde === null) {
    // Todavía no se cuenta: lo que se escribe es la apertura (la baja no tiene sentido sin existencias).
    if (motivo !== "conteo") return { error: "Primero haz el conteo de apertura de este alimento." };
    const { error } = await supabase.from("inventario_alimento_movimientos").insert({ finca_id: finca.id, producto_id: alimento.id, tipo: "apertura", fecha: d.fecha, cantidad: kg, observaciones: d.observaciones ?? null });
    if (error) return { error: error.code === "23505" ? "Este alimento ya tiene su conteo de apertura." : mensajeAmigable(error.message) };
  } else {
    const cambio = cambioDeAjuste(motivo, kg, existencias.stock_kg ?? 0);
    if (cambio === null) return { error: "Lo que contaste coincide con lo que dice la app: no hay nada que ajustar." };
    const { error } = await supabase.from("inventario_alimento_movimientos").insert({ finca_id: finca.id, producto_id: alimento.id, tipo: "ajuste", fecha: d.fecha, cantidad: cambio, motivo, observaciones: d.observaciones ?? null });
    if (error) return { error: mensajeAmigable(error.message) };
  }
  refrescar(alimento.id);
  redirect(`/inventario/alimento/${alimento.id}?guardado=1`);
}

/** Elimina un movimiento. El propietario y el administrador, cualquiera; quien anotó una salida, la suya (lo exige también la base de datos). */
export async function eliminarMovimientoAlimento(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "nutricion", finca.plan)) return { ok: false, error: SIN_PERMISO };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Movimiento no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("inventario_alimento_movimientos").delete().eq("id", id).eq("finca_id", finca.id).select("producto_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese movimiento, o solo quien lo anotó (o el propietario o el administrador) puede eliminarlo." };
  refrescar(data[0].producto_id);
  return { ok: true };
}
