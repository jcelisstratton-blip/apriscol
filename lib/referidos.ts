import { PLANES, usd, type Plan } from "@/lib/planes";

/** Los términos del programa de referidos: quien refiere recibe el 5 % del valor del plan de la persona referida, cada mes, durante 6 meses. */
export const PORCENTAJE_REFERIDO = 5;
export const MESES_REFERIDO = 6;

export const TEXTO_PROGRAMA = `Por cada persona que se registre con tu enlace y adquiera un plan, recibes el ${PORCENTAJE_REFERIDO} % del valor de ese plan cada mes durante ${MESES_REFERIDO} meses.`;

/** La aclaración que acompaña al programa: la comisión nace solo con la compra de un plan, y no hay ningún otro pago por referir. */
export const TEXTO_SOLO_CON_PLAN = "Solo se paga cuando la persona que recibió tu enlace adquiere un plan. Compartir el enlace o que alguien se registre sin comprar un plan no genera ningún pago: las comisiones son únicamente las de este programa.";

/** Lo que se gana cada mes con un plan (precio mensual del plan × 5 %), y en total durante los 6 meses. */
export const comisionMensual = (p: Plan, porcentaje = PORCENTAJE_REFERIDO) => Math.round(p.mensual * porcentaje) / 100;
export const comisionTotal = (p: Plan, porcentaje = PORCENTAJE_REFERIDO, meses = MESES_REFERIDO) => Math.round(p.mensual * porcentaje * meses) / 100;

/** Una fila por plan para explicar el programa con números. */
export const EJEMPLOS_REFERIDO = PLANES.map((p) => ({ plan: p.nombre, mensual: usd(comisionMensual(p)), total: usd(comisionTotal(p)) }));

/** Meses completos que han corrido desde que la persona adquirió su plan, sin pasar de los que dura el programa. */
export function mesesCorridos(desde: string, hoy: Date, meses = MESES_REFERIDO): number {
  const d = new Date(desde);
  let n = (hoy.getUTCFullYear() - d.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - d.getUTCMonth());
  if (hoy.getUTCDate() < d.getUTCDate()) n -= 1;
  return Math.max(0, Math.min(meses, n));
}

/** El enlace que se comparte: lleva el código de quien refiere. */
export const enlaceReferido = (sitio: string, codigo: string) => `${sitio}/registro?ref=${encodeURIComponent(codigo)}`;

/** Un código de referido válido (8 letras o números), o nada. */
export const codigoValido = (v: unknown): string | undefined => (typeof v === "string" && /^[A-Za-z0-9]{8}$/.test(v.trim()) ? v.trim().toUpperCase() : undefined);
