"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { formatoFecha } from "@/lib/fechas";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { leerNumero } from "@/lib/numeros";
import { nombrePlan, PLANES, planPorId, precioMes } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

export type ResultadoPlan = { ok: true; detalle: string } | { ok: false; error: string };

export type VistaPrevia = {
  fincaNombre: string;
  correo: string;
  numeroFinca: number;
  planActual: PlanId;
  estado: string;
  venceActual: string | null;
  venceNueva: string;
  ultimoPagoEn: string | null;
  /** Ya se confirmó un pago de esta finca hace unos minutos (posible doble clic). */
  pagoReciente: boolean;
  /** Valor de lista del periodo, en US$ (con el descuento de finca adicional), tal como se cobra. */
  usdEsperado: number;
};

const PERIODOS = ["mensual", "anual"];
/** Un pago de la misma finca confirmado hace menos de esto se avisa como posible duplicado. */
const MINUTOS_DUPLICADO = 10;

/** Lo que pasaría al confirmar este pago (plan y vigencia de hoy y de después), para mostrarlo antes de hacer clic. */
export async function previsualizarActivacion(fincaId: string, plan: string, periodo: string): Promise<{ ok: true; vista: VistaPrevia } | { ok: false; error: string }> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (!PLANES.some((p) => p.id === plan)) return { ok: false, error: "Ese plan no existe." };
  if (!PERIODOS.includes(periodo)) return { ok: false, error: "El periodo de pago no es válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_previsualizar_activacion", { p_finca: fincaId, p_plan: plan as PlanId, p_periodo: periodo as "mensual" | "anual" });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  const v = data?.[0];
  if (!v) return { ok: false, error: "No encontramos esa finca." };
  const anual = periodo === "anual";
  const mes = precioMes(planPorId(plan as PlanId), anual, v.numero_finca);
  return {
    ok: true,
    vista: {
      fincaNombre: v.finca_nombre,
      correo: v.correo,
      numeroFinca: v.numero_finca,
      planActual: v.plan_actual,
      estado: v.estado,
      venceActual: v.vence_actual,
      venceNueva: v.vence_nueva,
      ultimoPagoEn: v.ultimo_pago_en,
      pagoReciente: !!v.ultimo_pago_en && Date.now() - new Date(v.ultimo_pago_en).getTime() < MINUTOS_DUPLICADO * 60_000,
      usdEsperado: anual ? mes * 12 : mes,
    },
  };
}

/**
 * Confirma el pago de UNA finca: activa el plan, corre la vigencia un mes o un año y deja el pago registrado (valor de lista en US$, lo recibido en COP y la
 * referencia de Nequi, ambos opcionales). Si es la primera finca de alguien que llegó por referidos, nace su comisión.
 */
export async function activarPlan(fincaId: string, plan: string, periodo: string = "mensual", montoCop?: string, referencia?: string): Promise<ResultadoPlan> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (!PLANES.some((p) => p.id === plan)) return { ok: false, error: "Ese plan no existe." };
  if (!PERIODOS.includes(periodo)) return { ok: false, error: "El periodo de pago no es válido." };
  const cop = montoCop?.trim() ? leerNumero(montoCop) : null;
  if (montoCop?.trim() && (cop === null || cop <= 0)) return { ok: false, error: "El monto recibido no es válido. Escríbelo en pesos, por ejemplo 36.000." };
  const previa = await previsualizarActivacion(fincaId, plan, periodo);
  if (!previa.ok) return previa;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_confirmar_pago", {
    p_finca: fincaId,
    p_plan: plan as PlanId,
    p_periodo: periodo as "mensual" | "anual",
    p_monto_usd: previa.vista.usdEsperado,
    p_monto_cop: cop,
    p_referencia: referencia?.trim() || null,
  });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/planes");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/auditoria");
  revalidatePath("/admin");
  return { ok: true, detalle: `Plan ${nombrePlan(plan as PlanId)} activo hasta el ${formatoFecha(data, { day: "numeric", month: "long", year: "numeric" })}.` };
}

/** Marca (o desmarca) una cuenta como de pruebas: no se bloquea por vigencia, ni ella ni sus fincas. */
export async function marcarCuentaPruebas(correo: string, marcada: boolean): Promise<ResultadoPlan> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_marcar_cuenta_pruebas", { p_correo: correo, p_exenta: marcada });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (data === 0) return { ok: false, error: "No encontramos una cuenta con ese correo." };
  revalidatePath("/admin/planes");
  return { ok: true, detalle: marcada ? "Cuenta de pruebas: no se bloquea." : "La cuenta vuelve a regirse por la vigencia de su plan." };
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
