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
import { formasDe } from "@/lib/nomina";
import type { FormaPago, Vinculacion } from "@/lib/tipos";
import { opcional } from "@/lib/validacion";
import { perfilPorRol, type EntradaPerfil } from "@/lib/perfil-personal";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));
const ID_UUID = z.uuid();
const DIRECCION_PERSONAS = "/mas/miembros?guardado=1";
const DIRECCION_PAGOS = "/mas/miembros?vista=pagos&guardado=1";

function refrescar() {
  revalidatePath("/mas/miembros");
  revalidatePath("/costos");
  revalidatePath("/");
}

// ───────────────────────── Personas ─────────────────────────

const esquemaPersona = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre de la persona.").max(120, "El nombre es muy largo (máximo 120 letras)."),
  cargo: opcional(z.string().trim().max(60, "El cargo es muy largo (máximo 60 letras).")),
  vinculacion: z.enum(["laboral", "servicios"], "Elige cómo está vinculada."),
  forma_pago: z.enum(["mensual", "jornal", "por_servicio"], "Elige cómo se le paga."),
  valor_base: numero("Escribe cuánto se le paga (solo números).").pipe(z.number().min(0, "El valor no puede ser negativo.").max(99_999_999_999, "El valor es demasiado alto. Revísalo.")),
  fecha_ingreso: opcional(z.iso.date("Indica la fecha de ingreso.")),
  activo: z.enum(["si", "no"], "Indica si sigue trabajando."),
  fecha_retiro: opcional(z.iso.date("Indica la fecha de retiro.")),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  persona_id: opcional(ID_UUID),
});
type DatosPersona = z.output<typeof esquemaPersona>;

function revisarPersona(d: DatosPersona): string | null {
  if (!formasDe(d.vinculacion as Vinculacion).includes(d.forma_pago as FormaPago)) return "Con contrato de trabajo se paga por mes o por jornal.";
  if (d.activo === "no" && !d.fecha_retiro) return "Indica la fecha de retiro.";
  if (d.fecha_ingreso && d.fecha_retiro && d.fecha_retiro < d.fecha_ingreso) return "La fecha de retiro no puede ser anterior a la de ingreso.";
  return null;
}

const filaPersona = (d: DatosPersona) => ({
  nombre: d.nombre,
  cargo: d.cargo ?? null,
  vinculacion: d.vinculacion as Vinculacion,
  forma_pago: d.forma_pago as FormaPago,
  valor_base: d.valor_base,
  fecha_ingreso: d.fecha_ingreso ?? null,
  activo: d.activo === "si",
  fecha_retiro: d.activo === "no" ? (d.fecha_retiro ?? null) : null,
  observaciones: d.observaciones ?? null,
});

/** Los errores de la base que se pueden explicar en una frase (nombre repetido). */
const errorPersona = (mensaje: string) => (/personal_nombre_uk/.test(mensaje) ? "Ya tienes a una persona con ese nombre. Usa otro o ábrela para editarla." : mensajeAmigable(mensaje));

export async function crearPersona(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar personal en esta finca." };
  const datos = esquemaPersona.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const problema = revisarPersona(datos.data);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("personal").insert({ finca_id: finca.id, ...filaPersona(datos.data) });
  if (error) return { error: errorPersona(error.message) };
  refrescar();
  redirect(DIRECCION_PERSONAS);
}

export async function editarPersona(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para editar personal en esta finca." };
  const datos = esquemaPersona.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.persona_id) return { error: "No encontramos a esa persona." };
  const problema = revisarPersona(d);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  // Los datos del perfil dependen del perfil que ya tiene la persona (no se cambia al corregirla); no se exigen para no bloquear a quien ya estaba registrado.
  const { data: actual } = await supabase.from("personal").select("rol").eq("id", d.persona_id).eq("finca_id", finca.id).maybeSingle();
  if (!actual) return { error: "No encontramos a esa persona." };
  const perfil = perfilPorRol(actual.rol ?? "ninguno", Object.fromEntries(form) as EntradaPerfil, false);
  if ("error" in perfil) return { error: perfil.error };
  const { data, error } = await supabase.from("personal").update({ ...filaPersona(d), ...perfil.datos }).eq("id", d.persona_id).eq("finca_id", finca.id).select("id");
  if (error) return { error: errorPersona(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos a esa persona." };
  refrescar();
  redirect(DIRECCION_PERSONAS);
}

/** Elimina a una persona que no tiene pagos. Con pagos se da por retirada (se edita), para que su historial no se pierda. */
export async function eliminarPersona(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar personal." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Persona no válida." };
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("pagos_personal").select("id", { count: "exact", head: true }).eq("personal_id", id).eq("finca_id", finca.id);
  if ((count ?? 0) > 0) return { ok: false, error: "Esta persona tiene pagos registrados, así que no se puede eliminar. Márcala como retirada y su historial se conserva." };
  const { data, error } = await supabase.from("personal").delete().eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos a esa persona." };
  refrescar();
  return { ok: true };
}

// ───────────────────────── Pagos ─────────────────────────

const esquemaPago = z.object({
  personal_id: z.uuid("Elige a quién le pagaste."),
  fecha: z.iso.date("Indica la fecha del pago."),
  periodo_desde: opcional(z.iso.date("Indica desde cuándo es el pago.")),
  periodo_hasta: opcional(z.iso.date("Indica hasta cuándo es el pago.")),
  cantidad: numero("Escribe cuántos meses, días o servicios se pagan (solo números).").pipe(z.number().positive("La cantidad debe ser mayor que cero.").max(9999, "La cantidad es muy grande.")),
  valor_base: numero("Escribe el valor de cada uno (solo números).").pipe(z.number().min(0, "El valor no puede ser negativo.").max(99_999_999_999, "El valor es demasiado alto. Revísalo.")),
  pago: z.enum(["pagado", "por_pagar"], "Indica si ya se pagó."),
  pagado_en: opcional(z.iso.date("Indica la fecha de pago.")),
  soporte_pila: opcional(z.string().max(200)),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(ID_UUID),
  pago_id: opcional(ID_UUID),
});
type DatosPago = z.output<typeof esquemaPago>;

function revisarPago(d: DatosPago, fincaId: string): string | null {
  const hoy = hoyBogota();
  if (d.fecha > hoy) return "La fecha del pago no puede ser futura: registra lo que ya pagaste.";
  if (d.fecha < sumarDias(hoy, -3650)) return "Esa fecha es demasiado antigua. Revísala.";
  if (d.periodo_desde && d.periodo_hasta && d.periodo_hasta < d.periodo_desde) return "El periodo termina antes de empezar. Revisa las fechas.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en > hoy) return "La fecha de pago no puede ser futura.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en < d.fecha) return "No se puede pagar antes de la fecha del pago.";
  if (!soporteValido(d.soporte_pila, fincaId, "nomina")) return "El documento no es válido. Adjúntalo de nuevo.";
  return null;
}

const filaPago = (d: DatosPago) => ({
  personal_id: d.personal_id,
  fecha: d.fecha,
  periodo_desde: d.periodo_desde ?? null,
  periodo_hasta: d.periodo_hasta ?? null,
  cantidad: d.cantidad,
  valor_base: d.valor_base,
  pagado_en: d.pago === "pagado" ? (d.pagado_en ?? d.fecha) : null,
  soporte_pila: d.soporte_pila ?? null,
  observaciones: d.observaciones ?? null,
});

/** La persona debe ser de la finca; a quien está por prestación de servicios no se le registra como pagado sin su PILA. Devuelve un error en lenguaje llano. */
async function comprobarPersona(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, d: DatosPago): Promise<string | null> {
  const { data } = await supabase.from("personal").select("vinculacion").eq("id", d.personal_id).eq("finca_id", fincaId).maybeSingle();
  if (!data) return "No encontramos a esa persona. Elígela de nuevo.";
  if (data.vinculacion === "servicios" && d.pago === "pagado" && !d.soporte_pila) {
    return "Para registrar el pago a alguien por prestación de servicios, adjunta el soporte de pago de su seguridad social (PILA). Si todavía no lo tienes, déjalo como «Por pagar».";
  }
  return null;
}

export async function crearPago(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para registrar pagos en esta finca." };
  const datos = esquemaPago.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const problema = revisarPago(d, finca.id);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const persona = await comprobarPersona(supabase, finca.id, d);
  if (persona) return { error: persona };

  const { error } = await supabase.from("pagos_personal").insert({ finca_id: finca.id, ...filaPago(d), client_request_id: d.client_request_id ?? null });
  // Doble toque: ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };
  refrescar();
  redirect(DIRECCION_PAGOS);
}

export async function editarPago(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { error: "No tienes permiso para editar pagos en esta finca." };
  const datos = esquemaPago.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.pago_id) return { error: "No encontramos ese pago." };
  const problema = revisarPago(d, finca.id);
  if (problema) return { error: problema };
  const supabase = await crearClienteServidor();
  const persona = await comprobarPersona(supabase, finca.id, d);
  if (persona) return { error: persona };

  const { data, error } = await supabase.from("pagos_personal").update(filaPago(d)).eq("id", d.pago_id).eq("finca_id", finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese pago." };
  refrescar();
  redirect(DIRECCION_PAGOS);
}

/** Elimina un pago. Solo propietario o administrador (la base también lo exige). */
export async function eliminarPago(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar pagos." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Pago no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("pagos_personal").delete().eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese pago." };
  refrescar();
  return { ok: true };
}

/** Marca un pago como hecho (hoy, o en la fecha dada) o lo devuelve a «por pagar». A quien está por prestación de servicios hay que adjuntarle antes el PILA. */
export async function marcarPagoPersonal(id: string, pagado: boolean, fechaPago?: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { ok: false, error: "No tienes permiso para cambiar pagos en esta finca." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Pago no válido." };
  const hoy = hoyBogota();
  const fecha = fechaPago && /^\d{4}-\d{2}-\d{2}$/.test(fechaPago) ? fechaPago : hoy;
  if (pagado && fecha > hoy) return { ok: false, error: "La fecha de pago no puede ser futura." };
  const supabase = await crearClienteServidor();
  const { data: previo } = await supabase.from("pagos_personal").select("fecha").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!previo) return { ok: false, error: "No encontramos ese pago." };
  if (pagado && fecha < previo.fecha) return { ok: false, error: "No se puede pagar antes de la fecha del pago." };
  const { data, error } = await supabase.from("pagos_personal").update({ pagado_en: pagado ? fecha : null }).eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese pago." };
  refrescar();
  return { ok: true };
}
