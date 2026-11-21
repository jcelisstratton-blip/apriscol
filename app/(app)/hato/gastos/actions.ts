"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { DIRECCION_GASTOS } from "@/lib/hato";
import { esquemaCompra, filaCompra, recordarPrecioCompra, resolverListasCompra, revisarCompra } from "@/lib/compra-reglas";
import { moduloEnPlan } from "@/lib/planes";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const ID_UUID = z.uuid();

function refrescar(animal?: string | null) {
  revalidatePath("/hato");
  revalidatePath("/costos");
  revalidatePath("/");
  if (animal) revalidatePath(`/hato/${animal}`);
}

/** La compra se registró desde una novedad «Comprar»: queda atendida (si la persona no puede cambiarla, la compra se guarda igual y la novedad sigue como estaba). */
async function atenderNovedadDeCompra(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, novedadId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("novedades")
    .update({ estado: "atendida", revisada_por: user?.id ?? null, revisada_en: new Date().toISOString() })
    .eq("id", novedadId)
    .eq("finca_id", fincaId)
    .eq("tipo", "compra")
    .neq("estado", "atendida")
    .select("id");
  if (data && data.length > 0) {
    revalidatePath("/novedades");
    revalidatePath("/");
  }
}

export async function crearGasto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar gastos en esta finca." };
  const datos = esquemaCompra.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const problema = revisarCompra(d, finca.id, hoyBogota());
  if (problema) return { error: problema };
  if (d.rubro === "mano_obra") return { error: "Los pagos al personal se registran en Personal, para que se cuenten una sola vez como mano de obra." };

  const supabase = await crearClienteServidor();
  const listas = await resolverListasCompra(supabase, finca.id, d, moduloEnPlan(finca.plan, "sanidad"));
  if ("error" in listas) return { error: listas.error };
  const { error } = await supabase.from("gastos").insert({ finca_id: finca.id, ...filaCompra(d, listas.proveedor), client_request_id: d.client_request_id ?? null });
  // Doble toque: ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };
  if (!error) await recordarPrecioCompra(supabase, finca.id, d);
  if (d.novedad_id) await atenderNovedadDeCompra(supabase, finca.id, d.novedad_id);

  refrescar(d.animal_id);
  redirect(d.volver ? `/hato/${d.volver}?guardado=1#costos` : `${DIRECCION_GASTOS}&guardado=1`);
}

export async function editarGasto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para editar gastos en esta finca." };
  const datos = esquemaCompra.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.gasto_id) return { error: "No encontramos ese gasto." };
  const problema = revisarCompra(d, finca.id, hoyBogota());
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  const listas = await resolverListasCompra(supabase, finca.id, d, false);
  if ("error" in listas) return { error: listas.error };
  const { data, error } = await supabase.from("gastos").update(filaCompra(d, listas.proveedor)).eq("id", d.gasto_id).eq("finca_id", finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese gasto." };
  await recordarPrecioCompra(supabase, finca.id, d);

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
