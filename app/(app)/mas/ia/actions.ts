"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

type Resultado = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La persona quita el permiso de un asistente (Claude, por ejemplo): deja de ver su finca al instante. Si Claude se registró varias veces (una por cada vez que se
 * conectó), son varios permisos de una sola conexión y se quitan todos juntos. Supabase cierra sus sesiones y anula la renovación.
 */
export async function revocarAppsIa(clientIds: string[]): Promise<Resultado> {
  if (!Array.isArray(clientIds) || clientIds.length === 0 || clientIds.length > 25 || !clientIds.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false, error: "No se encontró esa conexión." };
  const supabase = await crearClienteServidor();
  for (const clientId of clientIds) {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) return { ok: false, error: mensajeAmigable(error.message) };
  }
  revalidatePath("/mas/ia");
  return { ok: true };
}
