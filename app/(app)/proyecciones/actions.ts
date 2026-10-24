"use server";

import { revalidatePath } from "next/cache";
import { permisoPara } from "@/lib/permiso-servidor";
import { puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { aEscenario, limpiarNombre, MAX_ESCENARIOS, NOMBRE_ESCENARIO_BASE, type EscenarioGuardado } from "@/lib/proyeccion/escenarios";
import { HORIZONTES, limpiarAjustes } from "@/lib/proyeccion/supuestos";

export type ResultadoEscenario = { ok: true; escenario: EscenarioGuardado } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICADO = "Ya tienes un escenario con ese nombre. Elige otro.";

async function permiso() {
  const p = await permisoPara("proyecciones")("guardar proyecciones");
  if (!p.ok) return p;
  if (!puedeGestionar(p.rol)) return { ok: false, error: "Solo el propietario y el administrador pueden guardar proyecciones." } as const;
  return p;
}

const textoError = (mensaje: string) => (/duplicate key|proyecciones_nombre_finca/i.test(mensaje) ? DUPLICADO : mensajeAmigable(mensaje));

/**
 * Guarda un escenario: con `id` actualiza sus ajustes y su horizonte; sin `id` crea uno nuevo con ese nombre (hasta 10 por finca).
 * Solo propietario y administrador; la base lo vuelve a exigir (RLS). Lo que llega del navegador se limpia: solo claves conocidas, con números dentro de su rango.
 */
export async function guardarEscenario(entrada: { id: string | null; nombre?: unknown; ajustes: unknown; horizonte: unknown }): Promise<ResultadoEscenario> {
  const p = await permiso();
  if (!p.ok) return { ok: false, error: p.error };
  const horizonte = HORIZONTES.find((h) => h === entrada.horizonte);
  if (!horizonte) return { ok: false, error: "Elige 12, 24 o 36 meses." };
  const ajustes = limpiarAjustes(entrada.ajustes);
  const supabase = await crearClienteServidor();

  if (entrada.id) {
    if (!UUID.test(entrada.id)) return { ok: false, error: "Ese escenario no existe." };
    const { data, error } = await supabase.from("proyecciones").update({ ajustes, horizonte_meses: horizonte }).eq("id", entrada.id).eq("finca_id", p.finca.id).select("id, nombre, horizonte_meses, ajustes").maybeSingle();
    if (error) return { ok: false, error: textoError(error.message) };
    if (!data) return { ok: false, error: "Ese escenario ya no existe." };
    revalidatePath("/proyecciones");
    return { ok: true, escenario: aEscenario(data) };
  }

  const nombre = limpiarNombre(entrada.nombre ?? NOMBRE_ESCENARIO_BASE);
  if (!nombre) return { ok: false, error: "Escribe un nombre de hasta 80 letras." };
  const { count, error: errorCuenta } = await supabase.from("proyecciones").select("id", { count: "exact", head: true }).eq("finca_id", p.finca.id);
  if (errorCuenta) return { ok: false, error: textoError(errorCuenta.message) };
  if ((count ?? 0) >= MAX_ESCENARIOS) return { ok: false, error: `Ya tienes ${MAX_ESCENARIOS} escenarios. Elimina alguno para crear otro.` };
  const { data, error } = await supabase.from("proyecciones").insert({ finca_id: p.finca.id, nombre, ajustes, horizonte_meses: horizonte }).select("id, nombre, horizonte_meses, ajustes").single();
  if (error) return { ok: false, error: textoError(error.message) };
  revalidatePath("/proyecciones");
  return { ok: true, escenario: aEscenario(data) };
}

export async function renombrarEscenario(id: string, nombreNuevo: unknown): Promise<ResultadoSimple> {
  const p = await permiso();
  if (!p.ok) return { ok: false, error: p.error };
  const nombre = limpiarNombre(nombreNuevo);
  if (!nombre) return { ok: false, error: "Escribe un nombre de hasta 80 letras." };
  if (!UUID.test(id)) return { ok: false, error: "Ese escenario no existe." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proyecciones").update({ nombre }).eq("id", id).eq("finca_id", p.finca.id);
  if (error) return { ok: false, error: textoError(error.message) };
  revalidatePath("/proyecciones");
  return { ok: true };
}

export async function eliminarEscenario(id: string): Promise<ResultadoSimple> {
  const p = await permiso();
  if (!p.ok) return { ok: false, error: p.error };
  if (!UUID.test(id)) return { ok: false, error: "Ese escenario no existe." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proyecciones").delete().eq("id", id).eq("finca_id", p.finca.id);
  if (error) return { ok: false, error: textoError(error.message) };
  revalidatePath("/proyecciones");
  return { ok: true };
}
