"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { validarParametros, type ParametrosAvisos } from "@/lib/notificaciones/parametros";

export type ResultadoAvisos = { ok: true } | { ok: false; error: string };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Superadmin: fija cuándo y qué recibe una persona de la finca por Telegram. La función SQL vuelve a comprobar quién llama y que la persona sea de la finca. */
export async function guardarAvisos(fincaId: string, userId: string, parametros: ParametrosAvisos): Promise<ResultadoAvisos> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (!ID_UUID.test(fincaId) || !ID_UUID.test(userId)) return { ok: false, error: "No encontramos a esa persona." };
  const v = validarParametros(parametros);
  if (!v.ok) return v;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("admin_guardar_notificaciones", { p_finca: fincaId, p_user: userId, p_datos: v.datos });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(`/admin/fincas/${fincaId}/avisos`);
  return { ok: true };
}
