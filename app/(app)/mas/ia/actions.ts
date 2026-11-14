"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { SITE_URL } from "@/lib/env";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { nombreValido, rutaMcp } from "@/lib/mcp/conexion";
import { generarToken, huellaDeToken, prefijoVisible } from "@/lib/mcp/token";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Crea una conexión para el asistente de la persona en su finca activa. El token se arma aquí, se devuelve UNA vez y en la base solo queda su huella.
 * La base exige que el dueño sea quien llama (RLS) y pone el tope de conexiones activas.
 */
export async function crearConexionIa(nombre: string): Promise<Resultado<{ token: string; url: string }>> {
  const limpio = nombreValido(typeof nombre === "string" ? nombre : "");
  if (!limpio) return { ok: false, error: "Ponle un nombre corto a la conexión (hasta 60 letras), por ejemplo «Claude en mi computador»." };
  const { finca, user } = await obtenerContexto();
  const token = generarToken();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tokens_ia").insert({ finca_id: finca.id, user_id: user.id, nombre: limpio, prefijo: prefijoVisible(token), huella: huellaDeToken(token) });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/mas/ia");
  return { ok: true, token, url: rutaMcp(SITE_URL) };
}

/** La conexión deja de funcionar al instante. Solo puede revocar las suyas (la base lo vuelve a exigir). */
export async function revocarConexionIa(id: string): Promise<Resultado> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "No se encontró esa conexión." };
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("tokens_ia").update({ revocado_en: new Date().toISOString() }).eq("id", id).eq("finca_id", finca.id).is("revocado_en", null).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No se encontró esa conexión." };
  revalidatePath("/mas/ia");
  return { ok: true };
}
