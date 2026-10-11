"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type ResultadoAdmin = { ok: true; detalle?: string } | { ok: false; error: string };

export async function revertirImportacion(id: string): Promise<ResultadoAdmin> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_revertir_importacion", { p_solicitud: id });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/importaciones");
  return { ok: true, detalle: `${data} animales retirados de la finca.` };
}
