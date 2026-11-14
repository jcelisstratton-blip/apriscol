"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

type Resultado = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La persona quita el permiso de un asistente (Claude, por ejemplo): deja de ver su finca al instante. Supabase cierra sus sesiones y anula la renovación. */
export async function revocarAppIa(clientId: string): Promise<Resultado> {
  if (typeof clientId !== "string" || !UUID.test(clientId)) return { ok: false, error: "No se encontró esa conexión." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/mas/ia");
  return { ok: true };
}
