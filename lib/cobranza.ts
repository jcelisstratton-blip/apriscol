import { formatoFecha } from "@/lib/fechas";
import type { DatosNequi } from "@/lib/pago-manual";
import { nombrePlan, planPorId, precioMes, usd } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";
import { DIAS_GRACIA, ultimoDiaDeGracia, type EstadoPlan } from "@/lib/vigencia";

/** Una finca vista desde la cobranza del superadmin (`admin_cobranza`). */
export type FilaCobranza = {
  finca_id: string;
  nombre: string;
  propietario_email: string;
  propietario_nombre: string;
  telefono: string;
  plan: PlanId;
  plan_vence_en: string | null;
  estado: EstadoPlan;
  dias_restantes: number | null;
  numero_finca: number;
  cuenta_pruebas: boolean;
  ultimo_pago_en: string | null;
};

export type FiltroCobranza = "por_cobrar" | "pendiente" | "por_vencer" | "gracia" | "bloqueada" | "todas";

/** «Por cobrar» junta todo lo que pide una gestión: finca sin activar, por vencer, en solo lectura o bloqueada. */
export function coincideFiltro(f: Pick<FilaCobranza, "estado">, filtro: FiltroCobranza): boolean {
  if (filtro === "todas") return true;
  if (filtro === "por_cobrar") return f.estado !== "vigente";
  return f.estado === filtro;
}

/** Número de WhatsApp en formato internacional sin «+» (Colombia): acepta «300 123 4567», «+57 300…», «573001234567». Si no parece un celular, null. */
export function telefonoWhatsApp(telefono: string): string | null {
  const d = telefono.replace(/\D/g, "");
  if (/^3\d{9}$/.test(d)) return `57${d}`;
  if (/^573\d{9}$/.test(d)) return d;
  return null;
}

const LARGA = { day: "numeric", month: "long", year: "numeric" } as const;

/**
 * Mensaje de cobro listo para pegar o enviar por WhatsApp, según el estado de la finca. Devuelve null si no hay nada que cobrar (al día).
 * Los precios salen de `precioMes` con el descuento de finca adicional; los datos de Nequi, si no hay, se reemplazan por una invitación a responder.
 */
export function mensajeCobranza(f: FilaCobranza, nequi: DatosNequi | null): string | null {
  if (f.estado === "vigente") return null;
  const plan = planPorId(f.plan);
  const mes = precioMes(plan, false, f.numero_finca);
  const anio = precioMes(plan, true, f.numero_finca) * 12;
  const saludo = `Hola${f.propietario_nombre ? ` ${f.propietario_nombre.split(/\s+/)[0]}` : ""}, te escribimos de Apriscol.`;
  const precio = `El plan ${nombrePlan(f.plan)} cuesta ${usd(mes)} al mes o ${usd(anio)} al año.`;
  const pago = nequi
    ? `Puedes pagar por Nequi al ${nequi.numero} (a nombre de ${nequi.titular}); en el mensaje escribe «${f.nombre}». Cuando pagues, avísanos por aquí o pulsa «Ya pagué» en la app y activamos tu finca.`
    : "Respóndenos y te compartimos los datos de pago por Nequi. Cuando pagues, avísanos y activamos tu finca.";
  const vence = f.plan_vence_en;

  let situacion: string;
  if (f.estado === "pendiente") {
    situacion = `Tu finca «${f.nombre}» ya está creada y se activa en cuanto confirmemos el pago del plan.`;
  } else if (f.estado === "por_vencer" && vence) {
    situacion = `El plan ${nombrePlan(f.plan)} de tu finca «${f.nombre}» vence el ${formatoFecha(vence, LARGA)}.`;
  } else if (f.estado === "gracia" && vence) {
    situacion = `El plan de tu finca «${f.nombre}» venció el ${formatoFecha(vence, LARGA)}. Hasta el ${formatoFecha(ultimoDiaDeGracia(vence), LARGA)} (${DIAS_GRACIA} días) solo puedes consultar; después la app se bloquea.`;
  } else if (vence) {
    situacion = `El plan de tu finca «${f.nombre}» venció el ${formatoFecha(vence, LARGA)} y la app está bloqueada. Tus datos siguen guardados y puedes descargarlos cuando quieras.`;
  } else {
    situacion = `Tu finca «${f.nombre}» tiene el pago pendiente.`;
  }
  return `${saludo} ${situacion} ${precio} ${pago}`;
}
