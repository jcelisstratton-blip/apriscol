"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { validarParametros, type ParametrosAvisos } from "@/lib/notificaciones/parametros";
import { puedeGestionar } from "@/lib/permisos";

export type ResultadoAvisos = { ok: true } | { ok: false; error: string };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Propietario o administrador: fija si una persona de SU finca recibe el resumen, a qué hora, qué días y con qué nivel. La finca sale de la sesión, no de lo que
 * manda el navegador; la función SQL vuelve a comprobar el rol y que un administrador no cambie los avisos del propietario. El máximo diario, las alertas y el
 * silencio no se tocan desde aquí.
 */
export async function guardarAvisosEquipo(_finca: string, userId: string, parametros: ParametrosAvisos): Promise<ResultadoAvisos> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "No tienes permiso para esto." };
  if (!ID_UUID.test(userId)) return { ok: false, error: "No encontramos a esa persona." };
  const v = validarParametros(parametros);
  if (!v.ok) return v;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_notificaciones_equipo", { p_finca: finca.id, p_user: userId, p_datos: v.datos });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/mas/miembros/avisos");
  return { ok: true };
}
