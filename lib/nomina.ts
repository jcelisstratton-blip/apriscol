import type { FormaPago, PagoPersonal, Persona, Vinculacion } from "@/lib/tipos";

export const VINCULACIONES: Vinculacion[] = ["laboral", "servicios"];
export const ETIQUETA_VINCULACION: Record<Vinculacion, string> = { laboral: "Contrato de trabajo", servicios: "Prestación de servicios" };
export const DETALLE_VINCULACION: Record<Vinculacion, string> = {
  laboral: "Le cuenta las prestaciones y la seguridad social que define tu finca en Ajustes",
  servicios: "Cobra honorarios y paga su propia seguridad social: se guarda su comprobante",
};

export const FORMAS_PAGO: FormaPago[] = ["mensual", "jornal", "por_servicio"];
export const ETIQUETA_FORMA_PAGO: Record<FormaPago, string> = { mensual: "Mensual", jornal: "Por jornal", por_servicio: "Por servicio" };
export const DETALLE_FORMA_PAGO: Record<FormaPago, string> = {
  mensual: "Un valor fijo cada mes",
  jornal: "Un valor por cada día trabajado",
  por_servicio: "Un valor por cada servicio prestado",
};

/** Qué se cuenta en un pago según cómo cobra la persona. */
export const UNIDAD_PAGO: Record<FormaPago, { plural: string; singular: string; valor: string }> = {
  mensual: { plural: "meses", singular: "mes", valor: "Salario o pago mensual" },
  jornal: { plural: "días", singular: "día", valor: "Valor de cada jornal" },
  por_servicio: { plural: "servicios", singular: "servicio", valor: "Valor de cada servicio" },
};

/** Las formas de pago que admite cada vinculación (el contrato de trabajo no se paga «por servicio»). */
export const formasDe = (v: Vinculacion): FormaPago[] => (v === "laboral" ? ["mensual", "jornal"] : FORMAS_PAGO);

/** Lo que recibe la persona y lo que le cuesta a la finca (con el factor prestacional si tiene contrato de trabajo). */
export function calcularPago(cantidad: number, valorBase: number, factor: number) {
  const pago = Math.round(cantidad * valorBase * 100) / 100;
  const costo = Math.round(cantidad * valorBase * factor * 100) / 100;
  return { pago, costo };
}

export const estaPorPagar = (p: Pick<PagoPersonal, "pagado_en">) => p.pagado_en === null;
/** ¿Hace falta el comprobante de seguridad social para marcar este pago como hecho? */
export const exigePila = (v: Persona["vinculacion"]) => v === "servicios";
