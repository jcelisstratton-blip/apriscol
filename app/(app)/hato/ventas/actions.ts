"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { DIRECCION_VENTAS } from "@/lib/hato";
import type { OrigenVenta } from "@/lib/tipos";
import { comprobarListasVenta, esquemaVenta, filaVenta, revisarVenta } from "@/lib/venta-reglas";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const ID_UUID = z.uuid();

function refrescar() {
  revalidatePath("/hato");
  revalidatePath("/costos");
  revalidatePath("/");
}

export async function crearVenta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar ventas en esta finca." };
  const datos = esquemaVenta.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const problema = revisarVenta(d, hoyBogota());
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const listas = await comprobarListasVenta(supabase, finca.id, d);
  if (listas) return { error: listas };

  const { error } = await supabase.from("ventas").insert({ finca_id: finca.id, ...filaVenta(d), client_request_id: d.client_request_id ?? null });
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
  const datos = esquemaVenta.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.venta_id) return { error: "No encontramos esa venta." };
  const problema = revisarVenta(d, hoyBogota());
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const listas = await comprobarListasVenta(supabase, finca.id, d);
  if (listas) return { error: listas };

  const { data, error } = await supabase.from("ventas").update(filaVenta(d)).eq("id", d.venta_id).eq("finca_id", finca.id).select("id");
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
