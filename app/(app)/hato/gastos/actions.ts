"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { soporteValido } from "@/lib/soportes";
import { DESTINOS, RUBROS } from "@/lib/costos";
import { DIRECCION_GASTOS } from "@/lib/hato";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());
const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));
const ID_UUID = z.uuid();

const esquema = z
  .object({
    fecha: z.iso.date("Indica la fecha del gasto."),
    rubro: z.enum(RUBROS as [string, ...string[]], "Elige en qué se gastó."),
    descripcion: z.string().trim().min(1, "Cuenta en una frase qué se compró o se pagó.").max(160, "La descripción es muy larga (máximo 160 letras)."),
    proveedor: opcional(z.string().trim().max(120, "El nombre del proveedor es muy largo.")),
    /** Proveedor elegido de la lista y producto elegido del catálogo (lo que se compró). */
    tercero_id: opcional(ID_UUID),
    producto_id: opcional(ID_UUID),
    cantidad: opcional(numero("La cantidad debe ser un número.").pipe(z.number().positive("La cantidad debe ser mayor que cero.").max(9_999_999_999, "La cantidad es muy grande."))),
    unidad: opcional(z.string().trim().max(20, "La unidad es muy larga.")),
    monto: numero("Escribe cuánto costó (solo números).").pipe(z.number().positive("El valor debe ser mayor que cero.").max(99_999_999_999, "El valor es demasiado grande. Revísalo.")),
    destino_tipo: z.enum(DESTINOS as [string, ...string[]], "Elige a quién se carga el gasto."),
    especie: opcional(z.enum(["caprino", "ovino"])),
    ubicacion_id: opcional(ID_UUID),
    lote_id: opcional(ID_UUID),
    animal_id: opcional(ID_UUID),
    pago: z.enum(["pagado", "por_pagar"], "Indica si ya se pagó."),
    pagado_en: opcional(z.iso.date("Indica la fecha de pago.")),
    vence: opcional(z.iso.date("Indica cuándo vence el pago.")),
    soporte_path: opcional(z.string().max(200)),
    observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
    client_request_id: opcional(ID_UUID),
    gasto_id: opcional(ID_UUID),
    /** Si se llegó desde la ficha de un animal: al guardar se vuelve a ella. */
    volver: opcional(ID_UUID),
  })
  .refine((d) => d.destino_tipo !== "especie" || d.especie, { message: "Elige si es de las cabras o de las ovejas.", path: ["especie"] })
  .refine((d) => d.destino_tipo !== "ubicacion" || d.ubicacion_id, { message: "Elige el corral o potrero.", path: ["ubicacion_id"] })
  .refine((d) => d.destino_tipo !== "lote" || d.lote_id, { message: "Elige el lote de ceba.", path: ["lote_id"] })
  .refine((d) => d.destino_tipo !== "animal" || d.animal_id, { message: "Elige el animal.", path: ["animal_id"] });

type Datos = z.output<typeof esquema>;

/** Lo que se guarda: solo el dato del destino elegido, y el pago resuelto (pagado → su fecha; por pagar → su vencimiento). */
function fila(d: Datos, proveedor: string | null) {
  return {
    fecha: d.fecha,
    rubro: d.rubro as never,
    descripcion: d.descripcion,
    proveedor,
    tercero_id: d.tercero_id ?? null,
    producto_id: d.producto_id ?? null,
    cantidad: d.cantidad ?? null,
    unidad: d.cantidad != null ? (d.unidad ?? null) : null,
    monto: d.monto,
    destino_tipo: d.destino_tipo as never,
    especie: d.destino_tipo === "especie" ? ((d.especie as "caprino" | "ovino") ?? null) : null,
    ubicacion_id: d.destino_tipo === "ubicacion" ? (d.ubicacion_id ?? null) : null,
    lote_id: d.destino_tipo === "lote" ? (d.lote_id ?? null) : null,
    animal_id: d.destino_tipo === "animal" ? (d.animal_id ?? null) : null,
    pagado_en: d.pago === "pagado" ? (d.pagado_en ?? d.fecha) : null,
    vence: d.pago === "por_pagar" ? (d.vence ?? null) : null,
    soporte_path: d.soporte_path ?? null,
    observaciones: d.observaciones ?? null,
  };
}

function revisar(d: Datos, fincaId: string): string | null {
  const hoy = hoyBogota();
  if (d.fecha > hoy) return "La fecha del gasto no puede ser futura: registra lo que ya se gastó.";
  if (d.fecha < sumarDias(hoy, -3650)) return "Esa fecha es demasiado antigua. Revísala.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en > hoy) return "La fecha de pago no puede ser futura.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en < d.fecha) return "No se puede pagar antes de la fecha del gasto.";
  if (d.pago === "por_pagar" && d.vence && d.vence < d.fecha) return "El pago no puede vencer antes de la fecha del gasto.";
  if (!soporteValido(d.soporte_path, fincaId, "gastos")) return "El documento no es válido. Adjúntalo de nuevo.";
  return null;
}

/**
 * Resuelve lo que se eligió de las listas: el nombre del proveedor (se guarda también como texto, para lo que lee lo anterior) y que el producto sea de la
 * finca, de compra y del mismo rubro. Devuelve el nombre del proveedor o un error en lenguaje llano.
 */
async function resolverListas(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, d: Datos): Promise<{ proveedor: string | null } | { error: string }> {
  let proveedor = d.proveedor ?? null;
  if (d.tercero_id) {
    const { data } = await supabase.from("finca_terceros").select("nombre").eq("id", d.tercero_id).eq("finca_id", fincaId).maybeSingle();
    if (!data) return { error: "No encontramos ese proveedor. Elígelo de nuevo." };
    proveedor = data.nombre;
  }
  if (d.producto_id) {
    const { data } = await supabase.from("finca_productos").select("tipo, rubro").eq("id", d.producto_id).eq("finca_id", fincaId).maybeSingle();
    if (!data || data.tipo !== "compra") return { error: "No encontramos ese producto. Elígelo de nuevo." };
    if (data.rubro !== d.rubro) return { error: "Ese producto no corresponde a ese rubro. Elígelo de nuevo." };
  }
  return { proveedor };
}

/** Guarda el precio por unidad como el habitual del producto, para proponerlo la próxima vez. No bloquea el guardado si falla. */
async function recordarPrecio(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, d: Datos) {
  if (!d.producto_id || !d.cantidad || d.cantidad <= 0) return;
  await supabase.rpc("recordar_precio_producto", { p_finca: fincaId, p_producto: d.producto_id, p_precio: Math.round((d.monto / d.cantidad) * 100) / 100 });
}

function refrescar(animal?: string | null) {
  revalidatePath("/hato");
  revalidatePath("/costos");
  revalidatePath("/");
  if (animal) revalidatePath(`/hato/${animal}`);
}

export async function crearGasto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar gastos en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const problema = revisar(d, finca.id);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  const listas = await resolverListas(supabase, finca.id, d);
  if ("error" in listas) return { error: listas.error };
  const { error } = await supabase.from("gastos").insert({ finca_id: finca.id, ...fila(d, listas.proveedor), client_request_id: d.client_request_id ?? null });
  // Doble toque: ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };
  if (!error) await recordarPrecio(supabase, finca.id, d);

  refrescar(d.animal_id);
  redirect(d.volver ? `/hato/${d.volver}?guardado=1#costos` : `${DIRECCION_GASTOS}&guardado=1`);
}

export async function editarGasto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para editar gastos en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.gasto_id) return { error: "No encontramos ese gasto." };
  const problema = revisar(d, finca.id);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  const listas = await resolverListas(supabase, finca.id, d);
  if ("error" in listas) return { error: listas.error };
  const { data, error } = await supabase.from("gastos").update(fila(d, listas.proveedor)).eq("id", d.gasto_id).eq("finca_id", finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese gasto." };
  await recordarPrecio(supabase, finca.id, d);

  refrescar(d.animal_id);
  redirect(d.volver ? `/hato/${d.volver}?guardado=1#costos` : `${DIRECCION_GASTOS}&guardado=1`);
}

/** Elimina un gasto. Solo propietario o administrador (la base también lo exige). */
export async function eliminarGasto(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar gastos." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Gasto no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("gastos").delete().eq("id", id).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese gasto." };
  refrescar(data[0].animal_id);
  return { ok: true };
}

/** Marca un gasto como pagado (hoy, o en la fecha dada) o lo devuelve a «por pagar». */
export async function marcarPago(id: string, pagado: boolean, fechaPago?: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { ok: false, error: "No tienes permiso para cambiar gastos en esta finca." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Gasto no válido." };
  const hoy = hoyBogota();
  const fecha = fechaPago && /^\d{4}-\d{2}-\d{2}$/.test(fechaPago) ? fechaPago : hoy;
  if (pagado && fecha > hoy) return { ok: false, error: "La fecha de pago no puede ser futura." };
  const supabase = await crearClienteServidor();
  const { data: previo } = await supabase.from("gastos").select("fecha").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!previo) return { ok: false, error: "No encontramos ese gasto." };
  if (pagado && fecha < previo.fecha) return { ok: false, error: "No se puede pagar antes de la fecha del gasto." };
  const { data, error } = await supabase.from("gastos").update({ pagado_en: pagado ? fecha : null }).eq("id", id).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese gasto." };
  refrescar(data[0].animal_id);
  return { ok: true };
}
