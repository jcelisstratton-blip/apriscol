"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { nombrePlan, PLANES } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

export type ResultadoPlan = { ok: true; detalle: string } | { ok: false; error: string };

/** Activa el plan de UNA finca (se usa cuando el pago ya está confirmado). Si es la primera finca de alguien que llegó por referidos, nace su comisión. */
export async function activarPlan(fincaId: string, plan: string): Promise<ResultadoPlan> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (!PLANES.some((p) => p.id === plan)) return { ok: false, error: "Ese plan no existe." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_asignar_plan_finca", { p_finca: fincaId, p_plan: plan as PlanId });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/planes");
  revalidatePath("/admin");
  return { ok: true, detalle: data === 1 ? `Plan ${nombrePlan(plan as PlanId)} activado en la finca.` : "No se encontró la finca." };
}
