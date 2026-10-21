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
import { DIRECCION_VENTAS } from "@/lib/hato";
import type { OrigenVenta } from "@/lib/tipos";
import { opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));
const ID_UUID = z.uuid();

const esquema = z.object({
  fecha: z.iso.date("Indica la fecha de la venta."),
  producto_id: z.uuid("Elige qué vendiste."),
  cantidad: numero("Escribe cuánto vendiste (solo números).").pipe(z.number().positive("La cantidad debe ser mayor que cero.").max(9_999_999_999, "La cantidad es muy grande.")),
  unidad: opcional(z.string().trim().max(20, "La unidad es muy larga.")),
  precio_unitario: numero("Escribe el precio de cada unidad (solo números).").pipe(z.number().min(0, "El precio no puede ser negativo.").max(99_999_999_999, "El precio es demasiado alto. Revísalo.")),
  tercero_id: opcional(ID_UUID),
  cobro: z.enum(["cobrado", "por_cobrar"], "Indica si ya te pagaron."),
  cobrado_en: opcional(z.iso.date("Indica la fecha del cobro.")),
  cobro_vence: opcional(z.iso.date("Indica cuándo esperas el pago.")),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(ID_UUID),
  venta_id: opcional(ID_UUID),
});
type Datos = z.output<typeof esquema>;

/** Lo que se guarda: el cobro resuelto (cobrado → su fecha; por cobrar → cuándo se espera). */
const fila = (d: Datos) => ({
  fecha: d.fecha,
  producto_id: d.producto_id,
  cantidad: d.cantidad,
  unidad: d.unidad ?? null,
  precio_unitario: d.precio_unitario,
  tercero_id: d.tercero_id ?? null,
  cobrado_en: d.cobro === "cobrado" ? (d.cobrado_en ?? d.fecha) : null,
  cobro_vence: d.cobro === "por_cobrar" ? (d.cobro_vence ?? null) : null,
  observaciones: d.observaciones ?? null,
});

function revisar(d: Datos): string | null {
  const hoy = hoyBogota();
  if (d.fecha > hoy) return "La fecha de la venta no puede ser futura: registra lo que ya vendiste.";
  if (d.fecha < sumarDias(hoy, -3650)) return "Esa fecha es demasiado antigua. Revísala.";
  if (d.cobro === "cobrado" && d.cobrado_en && d.cobrado_en > hoy) return "La fecha de cobro no puede ser futura.";
  if (d.cobro === "cobrado" && d.cobrado_en && d.cobrado_en < d.fecha) return "No se puede cobrar antes de la fecha de la venta.";
  if (d.cobro === "por_cobrar" && d.cobro_vence && d.cobro_vence < d.fecha) return "El pago no puede vencer antes de la fecha de la venta.";
  return null;
}

/** Que el producto sea de la finca y de venta (los que se registran solos desde Leche y desde la baja no se venden a mano), y el comprador también. */
async function comprobarListas(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, d: Datos): Promise<string | null> {
  const { data: p } = await supabase.from("finca_productos").select("tipo, automatico").eq("id", d.producto_id).eq("finca_id", fincaId).maybeSingle();
  if (!p || p.tipo !== "venta") return "No encontramos ese producto. Elígelo de nuevo.";
  if (p.automatico) return "Ese producto se registra solo: la leche, en Leche → Despachos; los animales, al darlos de baja.";
  if (d.tercero_id) {
    const { data: t } = await supabase.from("finca_terceros").select("id").eq("id", d.tercero_id).eq("finca_id", fincaId).maybeSingle();
    if (!t) return "No encontramos ese comprador. Elígelo de nuevo.";
  }
  return null;
}

function refrescar() {
  revalidatePath("/hato");
  revalidatePath("/costos");
  revalidatePath("/");
}

export async function crearVenta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar ventas en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const problema = revisar(d);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const listas = await comprobarListas(supabase, finca.id, d);
  if (listas) return { error: listas };

  const { error } = await supabase.from("ventas").insert({ finca_id: finca.id, ...fila(d), client_request_id: d.client_request_id ?? null });
  // Doble toque: ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };
  // El precio de esta venta es el que se propone la próxima vez.
  if (!error) await supabase.rpc("recordar_precio_producto", { p_finca: finca.id, p_producto: d.producto_id, p_precio: d.precio_unitario });
  refrescar();
  redirect(`${DIRECCION_VENTAS}&guardado=1`);
}

export async function editarVenta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para editar ventas en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.venta_id) return { error: "No encontramos esa venta." };
  const problema = revisar(d);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const listas = await comprobarListas(supabase, finca.id, d);
  if (listas) return { error: listas };

  const { data, error } = await supabase.from("ventas").update(fila(d)).eq("id", d.venta_id).eq("finca_id", finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa venta." };
  await supabase.rpc("recordar_precio_producto", { p_finca: finca.id, p_producto: d.producto_id, p_precio: d.precio_unitario });
  refrescar();
  redirect(`${DIRECCION_VENTAS}&guardado=1`);
}

/** Elimina una venta registrada. Solo propietario o administrador (la base también lo exige). */
export async function eliminarVenta(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar ventas." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Venta no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("ventas").delete().eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa venta." };
  refrescar();
  return { ok: true };
}

/** Marca una venta como cobrada (hoy, o en la fecha dada) o la devuelve a «por cobrar». Sirve para los tres orígenes: la venta, la leche y el animal. */
export async function marcarCobro(origen: OrigenVenta, id: string, cobrado: boolean, fechaCobro?: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { ok: false, error: "No tienes permiso para registrar cobros en esta finca." };
  if (!["venta", "leche", "animal"].includes(origen) || !ID_UUID.safeParse(id).success) return { ok: false, error: "Venta no válida." };
  const fecha = fechaCobro && /^\d{4}-\d{2}-\d{2}$/.test(fechaCobro) ? fechaCobro : hoyBogota();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("marcar_cobro_venta", { p_finca: finca.id, p_origen: origen, p_id: id, p_fecha: cobrado ? fecha : null });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  refrescar();
  return { ok: true };
}
