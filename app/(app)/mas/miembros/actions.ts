"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { leerNumero } from "@/lib/numeros";
import { formasDe } from "@/lib/nomina";
import type { FormaPago, Vinculacion } from "@/lib/tipos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { urlDelSitio } from "@/lib/sitio";
import { opcional } from "@/lib/validacion";

export type EstadoInvitar = { error?: string; enlace?: string; email?: string; persona?: string } | undefined;

const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));

/** Perfil elegido + contrato. «ninguno» = trabaja en la finca pero no usa la app (no lleva correo ni invitación). */
const esquema = z.object({
  rol: z.enum(["administrador", "ordenador", "veterinario", "contador", "ninguno"], "Elige qué perfil tendrá."),
  email: opcional(z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido."))),
  nombre: z.string().trim().min(1, "Escribe el nombre de la persona.").max(120, "El nombre es muy largo (máximo 120 letras)."),
  cargo: opcional(z.string().trim().max(60, "El cargo es muy largo (máximo 60 letras).")),
  vinculacion: z.enum(["laboral", "servicios"], "Elige cómo está vinculada."),
  forma_pago: z.enum(["mensual", "jornal", "por_servicio"], "Elige cómo se le paga."),
  valor_base: numero("Escribe cuánto se le paga (solo números).").pipe(z.number().min(0, "El valor no puede ser negativo.").max(99_999_999_999, "El valor es demasiado alto. Revísalo.")),
  fecha_ingreso: opcional(z.iso.date("Indica la fecha de ingreso.")),
});
/** Sin el contrato (planes que no incluyen personal y nómina): solo el perfil y el correo de quien se invita. */
const esquemaSoloInvitacion = z.object({
  rol: z.enum(["administrador", "ordenador", "veterinario", "contador"], "Elige qué perfil tendrá."),
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
});

/**
 * Agrega a alguien al equipo: guarda su contrato (Personal) y, si tendrá acceso a la app, crea la invitación. Primero la persona y después la invitación;
 * si la invitación falla (por ejemplo, ya hay una pendiente para ese correo), la persona recién creada se deshace para no dejar nada a medias.
 */
export async function invitar(_: EstadoInvitar, form: FormData): Promise<EstadoInvitar> {
  const { finca, rol, user } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador pueden agregar personas." };
  // El contrato de la persona (Personal y nómina) es de Profesional en adelante; en los demás planes solo se invita.
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) {
    const solo = esquemaSoloInvitacion.safeParse(Object.fromEntries(form));
    if (!solo.success) return { error: solo.error.issues[0]?.message };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from("invitaciones").insert({ finca_id: finca.id, email: solo.data.email, rol: solo.data.rol, invitado_por: user.id }).select("token").single();
    if (error || !data) return { error: error?.code === "23505" ? "Ya hay una invitación pendiente para ese correo." : mensajeAmigable(error?.message ?? "") };
    revalidatePath("/mas/miembros");
    return { enlace: `${await urlDelSitio()}/invitacion/${data.token}`, email: solo.data.email };
  }
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  const conAcceso = d.rol !== "ninguno";
  if (conAcceso && !d.email) return { error: "Escribe el correo con el que se va a registrar." };
  if (!formasDe(d.vinculacion as Vinculacion).includes(d.forma_pago as FormaPago)) return { error: "Con contrato de trabajo se paga por mes o por jornal." };

  const supabase = await crearClienteServidor();
  const { data: persona, error: errPersona } = await supabase
    .from("personal")
    .insert({
      finca_id: finca.id,
      nombre: d.nombre,
      cargo: d.cargo ?? null,
      vinculacion: d.vinculacion as Vinculacion,
      forma_pago: d.forma_pago as FormaPago,
      valor_base: d.valor_base,
      fecha_ingreso: d.fecha_ingreso ?? null,
      correo: conAcceso ? (d.email ?? null) : null,
      rol: conAcceso ? (d.rol as Exclude<typeof d.rol, "ninguno">) : null,
    })
    .select("id")
    .single();
  if (errPersona || !persona) {
    const repetida = /personal_nombre_uk/.test(errPersona?.message ?? "");
    return { error: repetida ? "Ya tienes a una persona con ese nombre. Usa otro o ábrela para editarla." : mensajeAmigable(errPersona?.message ?? "") };
  }

  if (!conAcceso) {
    revalidatePath("/mas/miembros");
    revalidatePath("/costos");
    return { persona: d.nombre };
  }

  const { data, error } = await supabase
    .from("invitaciones")
    .insert({ finca_id: finca.id, email: d.email!, rol: d.rol as Exclude<typeof d.rol, "ninguno">, invitado_por: user.id })
    .select("token")
    .single();
  if (error || !data) {
    await supabase.from("personal").delete().eq("id", persona.id).eq("finca_id", finca.id);
    const duplicada = error?.code === "23505";
    return { error: duplicada ? "Ya hay una invitación pendiente para ese correo." : mensajeAmigable(error?.message ?? "") };
  }
  revalidatePath("/mas/miembros");
  return { enlace: `${await urlDelSitio()}/invitacion/${data.token}`, email: d.email! };
}

export async function revocarInvitacion(id: string): Promise<{ error?: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para esto." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("invitaciones").delete().eq("id", id).eq("finca_id", finca.id);
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/mas/miembros");
  return {};
}
