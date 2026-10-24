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
import { cargoDelPerfil, perfilPorRol } from "@/lib/perfil-personal";

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
  // Los datos propios del perfil llegan como texto: `perfilPorRol` los valida y descarta los que no son del perfil.
  telefono: z.string().optional(),
  experiencia_anios: z.string().optional(),
  formacion: z.string().optional(),
  tarjeta_profesional: z.string().optional(),
  tipo_contador: z.string().optional(),
  especialidades: z.string().optional(),
  acreditaciones: z.string().optional(),
  turno_ordeno: z.string().optional(),
  tipo_ordeno: z.string().optional(),
  curso_manipulacion: z.string().optional(),
  curso_manipulacion_vence: z.string().optional(),
  labor_principal: z.string().optional(),
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
  // Un veterinario puede quedar en el equipo sin correo (uno externo que no usa la app): se ofrece en los procedimientos pero no se invita.
  const conAcceso = d.rol !== "ninguno" && !(d.rol === "veterinario" && !d.email);
  if (conAcceso && !d.email) return { error: "Escribe el correo con el que se va a registrar." };
  if (!formasDe(d.vinculacion as Vinculacion).includes(d.forma_pago as FormaPago)) return { error: "Con contrato de trabajo se paga por mes o por jornal." };

  const perfil = perfilPorRol(d.rol, d, true);
  if ("error" in perfil) return { error: perfil.error };

  const supabase = await crearClienteServidor();
  // Un solo paso en la base: la persona y, si va a tener acceso, su invitación se guardan juntas (si la invitación falla, la persona no queda).
  const { data: r, error } = await supabase.rpc("registrar_persona", {
    p_finca: finca.id,
    p_persona: {
      nombre: d.nombre,
      cargo: cargoDelPerfil(d.rol, perfil.datos, d.cargo),
      vinculacion: d.vinculacion,
      forma_pago: d.forma_pago,
      valor_base: d.valor_base,
      fecha_ingreso: d.fecha_ingreso ?? null,
      ...perfil.datos,
      es_veterinario: d.rol === "veterinario",
    },
    p_email: conAcceso ? (d.email ?? null) : null,
    p_rol: conAcceso ? d.rol : null,
  });
  if (error || !r) {
    if (/personal_nombre_uk/.test(error?.message ?? "")) return { error: "Ya tienes a una persona con ese nombre. Usa otro o ábrela para editarla." };
    if (error?.code === "23505") return { error: "Ya hay una invitación pendiente para ese correo." };
    return { error: mensajeAmigable(error?.message ?? "") };
  }
  const { token } = r as { persona_id: string; token: string | null };

  if (!conAcceso || !token) {
    revalidatePath("/mas/miembros");
    revalidatePath("/costos");
    return { persona: d.nombre };
  }

  revalidatePath("/mas/miembros");
  revalidatePath("/costos");
  return { enlace: `${await urlDelSitio()}/invitacion/${token}`, email: d.email! };
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
