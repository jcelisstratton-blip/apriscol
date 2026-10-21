import { diasHasta, sumarDias } from "@/lib/fechas";

/**
 * Vigencia del plan de una finca. Espejo de `private.estado_plan` en la base (los mismos números y la misma regla):
 *  · `plan_vence_en` es el ÚLTIMO día pagado. Sin fecha, no vence.
 *  · Faltando `DIAS_AVISO` o menos → «por_vencer» (solo aviso). Pasada la fecha → «gracia»: `DIAS_GRACIA` días de solo lectura.
 *    Después → «bloqueada»: no se puede usar la app, pero sí descargar los datos y pedir la renovación.
 */
export const DIAS_AVISO = 7;
export const DIAS_GRACIA = 7;

export type EstadoPlan = "vigente" | "por_vencer" | "gracia" | "bloqueada";

export function estadoPlan(venceEn: string | null | undefined, hoy: string): EstadoPlan {
  if (!venceEn) return "vigente";
  const faltan = diasHasta(venceEn, hoy);
  if (faltan < -DIAS_GRACIA) return "bloqueada";
  if (faltan < 0) return "gracia";
  if (faltan <= DIAS_AVISO) return "por_vencer";
  return "vigente";
}

/** Último día de solo lectura (el día en que la app se bloquea es el siguiente). */
export const ultimoDiaDeGracia = (venceEn: string) => sumarDias(venceEn, DIAS_GRACIA);
