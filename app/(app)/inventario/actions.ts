"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { leerNumero } from "@/lib/numeros";
import { MOTIVOS_AJUSTE, aUnidades, cambioDeAjuste, type MotivoAjuste } from "@/lib/inventario";
import { decimal, noFutura, opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

const SIN_PERMISO = "No tienes permiso para mover el inventario de esta finca.";

/** El producto, con lo que hace falta para pasar lo que la persona cuenta (frascos) a la unidad de la dosis (ml). El factor lo pone el servidor, nunca el navegador. */
async function cargarProducto(supabase: Cliente, fincaId: string, id: string) {
  const { data } = await supabase
    .from("productos_veterinarios")
    .select("id, nombre, unidad_dosis, presentacion, contenido_presentacion, stock_minimo")
    .eq("id", id)
    .eq("finca_id", fincaId)
    .maybeSingle();
  return data;
}
const factorDe = (p: { contenido_presentacion: number | null }) => (p.contenido_presentacion && p.contenido_presentacion > 0 ? p.contenido_presentacion : 1);

function refrescar(productoId: string) {
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productoId}`);
  revalidatePath("/");
}

// ───────────────────────── Presentación y mínimo ─────────────────────────
const esquemaPresentacion = z.object({
  producto_id: z.uuid(),
  presentacion: opcional(z.string().trim().max(30, "El nombre de la presentación es muy largo (máximo 30 letras).")),
  contenido: decimal(z.number("Escribe un número en lo que trae cada presentación.").gt(0, "Lo que trae cada presentación debe ser mayor que cero.").max(1_000_000, "Ese número es demasiado grande.")),
  minimo: decimal(z.number("Escribe un número en el mínimo.").min(0, "El mínimo no puede ser negativo.").max(100_000_000, "Ese número es demasiado grande.")),
});

/** Cómo viene el producto (frasco de 100 ml) y desde cuánto se avisa que queda poco. El mínimo se escribe en presentaciones si el producto tiene una. */
export async function guardarPresentacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) return { error: SIN_PERMISO };
  const datos = esquemaPresentacion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (Boolean(d.presentacion) !== (d.contenido !== undefined)) return { error: "Escribe cómo viene el producto y cuánto trae cada uno (por ejemplo «frasco» y 100), o deja los dos vacíos." };
  const supabase = await crearClienteServidor();
  const producto = await cargarProducto(supabase, finca.id, d.producto_id);
  if (!producto) return { error: "No encontramos ese producto." };
  const factor = d.contenido ?? 1;
  const { error } = await supabase
    .from("productos_veterinarios")
    .update({ presentacion: d.presentacion ?? null, contenido_presentacion: d.contenido ?? null, stock_minimo: d.minimo === undefined ? null : aUnidades(d.minimo, factor) })
    .eq("id", d.producto_id)
    .eq("finca_id", finca.id);
  if (error) return { error: mensajeAmigable(error.message) };
  refrescar(d.producto_id);
  redirect(`/inventario/${d.producto_id}?guardado=1`);
}

// ───────────────────────── Conteo de apertura ─────────────────────────
const fechaConteo = z.iso.date("Indica la fecha del conteo.");

/**
 * Lo que hay en la bodega de un producto el día que se empieza a contarlo, uno o varios lotes. Si ya hay apertura, se corrige: las filas con `id` se
 * actualizan, las nuevas se agregan. Desde esa fecha el stock se calcula solo con las compras y las aplicaciones.
 */
export async function guardarApertura(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) return { error: SIN_PERMISO };
  const productoId = z.uuid().safeParse(form.get("producto_id"));
  const fecha = fechaConteo.safeParse(form.get("fecha"));
  if (!productoId.success) return { error: "Producto no válido." };
  if (!fecha.success) return { error: fecha.error.issues[0]?.message ?? "Indica la fecha del conteo." };
  const futura = noFutura(fecha.data);
  if (futura) return { error: futura };

  const ids = form.getAll("id").map(String);
  const lotes = form.getAll("lote").map((l) => String(l).trim());
  const vencimientos = form.getAll("vencimiento").map(String);
  const cantidades = form.getAll("cantidad").map(String);
  if (cantidades.length === 0 || cantidades.length > 50) return { error: "Anota al menos un lote con su cantidad." };
  if (lotes.length !== cantidades.length || vencimientos.length !== cantidades.length || ids.length !== cantidades.length) return { error: "Revisa los datos del conteo." };

  const supabase = await crearClienteServidor();
  const producto = await cargarProducto(supabase, finca.id, productoId.data);
  if (!producto) return { error: "No encontramos ese producto." };
  const factor = factorDe(producto);

  const filas: { id: string; lote: string | null; vencimiento: string | null; cantidad: number }[] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < cantidades.length; i++) {
    const n = leerNumero(cantidades[i]);
    if (n === null || n < 0 || n > 1_000_000) return { error: `Escribe cuánto hay en el lote ${i + 1} (un número, puede ser 0).` };
    if (lotes[i].length > 60) return { error: "El nombre de un lote es muy largo (máximo 60 letras)." };
    if (vencimientos[i] && !z.iso.date().safeParse(vencimientos[i]).success) return { error: "La fecha de vencimiento no es válida." };
    const clave = lotes[i].toLowerCase();
    if (vistos.has(clave)) return { error: "Hay dos filas con el mismo lote. Junta las cantidades en una sola." };
    vistos.add(clave);
    filas.push({ id: ids[i], lote: lotes[i] || null, vencimiento: vencimientos[i] || null, cantidad: aUnidades(n, factor) });
  }

  const { data: previas, error: errPrevias } = await supabase.from("inventario_movimientos").select("id").eq("finca_id", finca.id).eq("producto_vet_id", producto.id).eq("tipo", "apertura");
  if (errPrevias) return { error: mensajeAmigable(errPrevias.message) };
  const existentes = new Set((previas ?? []).map((p) => p.id));
  if (ids.some((id) => id && !existentes.has(id))) return { error: "Ese conteo ya cambió. Vuelve a abrirlo." };
  // Una apertura nueva no puede repetir una ya hecha: se corrige, no se duplica.
  if (existentes.size > 0 && ids.every((id) => !id)) return { error: "Este producto ya tiene su conteo de apertura. Edítalo desde su ficha." };

  const nuevas = filas.filter((f) => !f.id);
  if (nuevas.length > 0) {
    const { error } = await supabase.from("inventario_movimientos").insert(
      nuevas.map((f) => ({ finca_id: finca.id, producto_vet_id: producto.id, tipo: "apertura" as const, fecha: fecha.data, cantidad: f.cantidad, lote: f.lote, vencimiento: f.vencimiento })),
    );
    if (error) return { error: error.code === "23505" ? "Ya hay un conteo de apertura para ese lote." : mensajeAmigable(error.message) };
  }
  for (const f of filas.filter((x) => x.id)) {
    const { error } = await supabase.from("inventario_movimientos").update({ fecha: fecha.data, cantidad: f.cantidad, lote: f.lote, vencimiento: f.vencimiento }).eq("id", f.id).eq("finca_id", finca.id).eq("tipo", "apertura");
    if (error) return { error: error.code === "23505" ? "Ya hay un conteo de apertura para ese lote." : mensajeAmigable(error.message) };
  }
  refrescar(producto.id);
  redirect(`/inventario/${producto.id}?guardado=1`);
}

// ───────────────────────── Ajustes ─────────────────────────
const esquemaAjuste = z.object({
  producto_id: z.uuid(),
  motivo: z.enum(MOTIVOS_AJUSTE as [string, ...string[]], "Elige el motivo del ajuste."),
  lote: opcional(z.string().trim().max(60)),
  cantidad: decimal(z.number("Escribe la cantidad.").min(0, "La cantidad no puede ser negativa.").max(1_000_000, "Ese número es demasiado grande.")),
  fecha: z.iso.date("Indica la fecha."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
});

/**
 * Corrige las existencias: «conteo físico» (lo que contaste frente a lo que decía la app) o una baja (vencido, pérdida, daño). Queda como un movimiento con
 * su motivo y fecha; el stock lo vuelve a calcular la base.
 */
export async function guardarAjuste(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) return { error: SIN_PERMISO };
  const datos = esquemaAjuste.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (d.cantidad === undefined) return { error: "Escribe la cantidad." };
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  if (d.motivo === "otro" && !d.observaciones) return { error: "Cuéntanos el motivo en las observaciones." };
  if (d.motivo !== "conteo" && d.cantidad === 0) return { error: "Escribe cuánto se descarta (más de 0)." };

  const supabase = await crearClienteServidor();
  const producto = await cargarProducto(supabase, finca.id, d.producto_id);
  if (!producto) return { error: "No encontramos ese producto." };
  const { data: lotes, error: errLotes } = await supabase.rpc("inventario_lotes", { p_finca: finca.id, p_producto: producto.id });
  if (errLotes) return { error: mensajeAmigable(errLotes.message) };
  if (!lotes || lotes.length === 0) return { error: "Primero haz el conteo de apertura de este producto." };

  const lote = d.lote ?? null;
  const actual = lotes.find((l) => (l.lote ?? null) === lote);
  if (lote && !actual) return { error: "Ese lote no está en el inventario. Elígelo de la lista." };
  const cambio = cambioDeAjuste(d.motivo as MotivoAjuste, aUnidades(d.cantidad, factorDe(producto)), actual?.stock ?? 0);
  if (cambio === null) return { error: "Lo que contaste coincide con lo que dice la app: no hay nada que ajustar." };

  const { error } = await supabase.from("inventario_movimientos").insert({
    finca_id: finca.id,
    producto_vet_id: producto.id,
    tipo: "ajuste",
    fecha: d.fecha,
    cantidad: cambio,
    lote,
    vencimiento: actual?.vencimiento ?? null,
    motivo: d.motivo as MotivoAjuste,
    observaciones: d.observaciones ?? null,
  });
  if (error) return { error: mensajeAmigable(error.message) };
  refrescar(producto.id);
  redirect(`/inventario/${producto.id}?guardado=1`);
}

/** Elimina un conteo (un ajuste mal hecho o una fila de la apertura). Si era la única apertura, el producto vuelve a «Por contar». */
export async function eliminarConteo(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) return { ok: false, error: SIN_PERMISO };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Conteo no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("inventario_movimientos").delete().eq("id", id).eq("finca_id", finca.id).select("producto_vet_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese conteo, o solo el propietario o el administrador puede eliminarlo." };
  refrescar(data[0].producto_vet_id);
  return { ok: true };
}

