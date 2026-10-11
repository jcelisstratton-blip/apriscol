"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { urlDelSitio } from "@/lib/sitio";

export type EstadoInvitar = { error?: string; enlace?: string; email?: string } | undefined;

const esquema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
  rol: z.enum(["administrador", "ordenador", "veterinario", "contador"]),
});

export async function invitar(_: EstadoInvitar, form: FormData): Promise<EstadoInvitar> {
  const { finca, rol, user } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador pueden invitar personas." };
  const datos = esquema.safeParse({ email: form.get("email"), rol: form.get("rol") });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("invitaciones")
    .insert({ finca_id: finca.id, email: datos.data.email, rol: datos.data.rol, invitado_por: user.id })
    .select("token")
    .single();
  if (error || !data) {
    const duplicada = error?.code === "23505";
    return { error: duplicada ? "Ya hay una invitación pendiente para ese correo." : mensajeAmigable(error?.message ?? "") };
  }
  revalidatePath("/mas/miembros");
  return { enlace: `${await urlDelSitio()}/invitacion/${data.token}`, email: datos.data.email };
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
