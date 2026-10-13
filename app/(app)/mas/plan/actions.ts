"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { nombrePlan, PLANES, rangoPlan } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

export type ResultadoMejora = { ok: true; plan: PlanId } | { ok: false; error: string };

/** El propietario pide pasar a un plan superior al suyo. La base vuelve a comprobar que sea solo hacia adelante. */
export async function solicitarMejora(plan: string, periodo: string): Promise<ResultadoMejora> {
  const { finca, rol } = await obtenerContexto();
  if (rol !== "propietario") return { ok: false, error: "Solo el propietario de la finca puede mejorar el plan." };
  const elegido = PLANES.find((p) => p.id === plan);
  if (!elegido) return { ok: false, error: "Ese plan no existe." };
  if (rangoPlan(elegido.id) <= rangoPlan(finca.plan)) return { ok: false, error: `Solo puedes mejorar hacia un plan superior al ${nombrePlan(finca.plan)}.` };
  if (periodo !== "mensual" && periodo !== "anual") return { ok: false, error: "Elige si pagas cada mes o cada año." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("solicitar_mejora_plan", { p_finca: finca.id, p_plan: elegido.id, p_periodo: periodo });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/mas/plan");
  return { ok: true, plan: elegido.id };
}
