"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type ResultadoAdmin = { ok: true; detalle?: string } | { ok: false; error: string };

export async function aprobarReclamo(id: string): Promise<ResultadoAdmin> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("aprobar_reclamo", { p_solicitud: id });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/reclamos");
  revalidatePath("/hato");
  return { ok: true, detalle: `${data.importados} animales traídos a la finca.` };
}

export async function rechazarReclamo(id: string, motivo: string): Promise<ResultadoAdmin> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("rechazar_reclamo", { p_solicitud: id, p_motivo: motivo.slice(0, 300) });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/reclamos");
  return { ok: true };
}
