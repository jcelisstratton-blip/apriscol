"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type ResultadoRenovacion = { ok: true } | { ok: false; error: string };

/** El propietario pide renovar el plan que ya tiene. El equipo de Apriscol lo activa al confirmar el pago (no hay pasarela todavía). */
export async function solicitarRenovacion(periodo: string): Promise<ResultadoRenovacion> {
  const { finca, rol } = await obtenerContexto();
  if (rol !== "propietario") return { ok: false, error: "Solo el propietario de la finca puede renovar el plan." };
  if (periodo !== "mensual" && periodo !== "anual") return { ok: false, error: "Elige si pagas cada mes o cada año." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_renovacion_plan", { p_finca: finca.id, p_periodo: periodo });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/plan-vencido");
  return { ok: true };
}
