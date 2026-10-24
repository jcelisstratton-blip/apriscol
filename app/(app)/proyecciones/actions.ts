"use server";

import { revalidatePath } from "next/cache";
import { permisoPara } from "@/lib/permiso-servidor";
import { puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { HORIZONTES, limpiarAjustes } from "@/lib/proyeccion/supuestos";

export type ResultadoGuardar = { ok: true } | { ok: false; error: string };

/** El escenario que se usa hoy (Fase 1: uno solo por finca). */
const NOMBRE_ESCENARIO_BASE = "Mi proyección";

/**
 * Guarda los ajustes de la persona y el horizonte. Solo propietario y administrador; la base lo vuelve a exigir (RLS). Lo que llega del navegador
 * se limpia: solo claves conocidas, con números dentro de su rango.
 */
export async function guardarProyeccion(entrada: { ajustes: unknown; horizonte: unknown }): Promise<ResultadoGuardar> {
  const permiso = await permisoPara("proyecciones")("guardar proyecciones");
  if (!permiso.ok) return { ok: false, error: permiso.error };
  if (!puedeGestionar(permiso.rol)) return { ok: false, error: "Solo el propietario y el administrador pueden guardar proyecciones." };
  const horizonte = HORIZONTES.find((h) => h === entrada.horizonte);
  if (!horizonte) return { ok: false, error: "Elige 12, 24 o 36 meses." };
  const ajustes = limpiarAjustes(entrada.ajustes);

  const supabase = await crearClienteServidor();
  const { data: existente, error: errorLeer } = await supabase
    .from("proyecciones")
    .select("id")
    .eq("finca_id", permiso.finca.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (errorLeer) return { ok: false, error: mensajeAmigable(errorLeer.message) };

  const { error } = existente
    ? await supabase.from("proyecciones").update({ ajustes, horizonte_meses: horizonte }).eq("id", existente.id).eq("finca_id", permiso.finca.id)
    : await supabase.from("proyecciones").insert({ finca_id: permiso.finca.id, nombre: NOMBRE_ESCENARIO_BASE, ajustes, horizonte_meses: horizonte });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/proyecciones");
  return { ok: true };
}
