"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { formatoFecha } from "@/lib/fechas";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { nombrePlan, PLANES } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

export type ResultadoPlan = { ok: true; detalle: string } | { ok: false; error: string };

/** Confirma el pago de UNA finca: activa el plan y corre la vigencia un mes o un año. Si es la primera finca de alguien que llegó por referidos, nace su comisión. */
export async function activarPlan(fincaId: string, plan: string, periodo: string = "mensual"): Promise<ResultadoPlan> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (!PLANES.some((p) => p.id === plan)) return { ok: false, error: "Ese plan no existe." };
  if (periodo !== "mensual" && periodo !== "anual") return { ok: false, error: "El periodo de pago no es válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_activar_plan_finca", { p_finca: fincaId, p_plan: plan as PlanId, p_periodo: periodo });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/planes");
  revalidatePath("/admin");
  return { ok: true, detalle: `Plan ${nombrePlan(plan as PlanId)} activo hasta el ${formatoFecha(data, { day: "numeric", month: "long", year: "numeric" })}.` };
}

/** Fija a mano el último día pagado de una finca (las que ya existían) o lo quita: sin fecha, el plan no vence. */
export async function fijarVigencia(fincaId: string, fecha: string | null): Promise<ResultadoPlan> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha no es válida." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("admin_fijar_vigencia_finca", { p_finca: fincaId, p_fecha: fecha });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/planes");
  return { ok: true, detalle: fecha ? `Vigencia fijada hasta el ${formatoFecha(fecha, { day: "numeric", month: "long", year: "numeric" })}.` : "Quedó sin vencimiento." };
}
