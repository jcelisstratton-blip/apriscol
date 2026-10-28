"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type EstadoAceptar = { error?: string } | undefined;

export async function aceptarInvitacion(token: string): Promise<EstadoAceptar> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "El enlace de la invitación no es válido." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("aceptar_invitacion", { p_token: token });
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/", "layout");
  redirect("/");
}

/** Cierra la sesión que está abierta y vuelve a esta invitación: sin sesión, la app pide entrar y regresa aquí con el correo correcto. */
export async function cerrarSesionYVolver(token: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect("/login");
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect(`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`);
}
