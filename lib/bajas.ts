import type { MotivoBaja, TipoBaja } from "@/lib/tipos";

export const TIPOS_BAJA: { valor: TipoBaja; etiqueta: string; detalle: string }[] = [
  { valor: "venta", etiqueta: "Venta", detalle: "Se vendió o pasó a otro dueño" },
  { valor: "muerte", etiqueta: "Muerte", detalle: "Murió en la finca" },
  { valor: "sacrificio", etiqueta: "Sacrificio", detalle: "Se sacrificó para consumo" },
  { valor: "perdida", etiqueta: "Pérdida", detalle: "Se perdió o no se sabe dónde está" },
];

export const ETIQUETA_TIPO_BAJA: Record<TipoBaja, string> = {
  venta: "Venta",
  muerte: "Muerte",
  sacrificio: "Sacrificio",
  perdida: "Pérdida",
};

export const MOTIVOS_BAJA: { valor: MotivoBaja; etiqueta: string }[] = [
  { valor: "edad", etiqueta: "Edad" },
  { valor: "partos", etiqueta: "Muchos partos" },
  { valor: "baja_produccion", etiqueta: "Baja producción" },
  { valor: "sanidad", etiqueta: "Problemas de salud" },
  { valor: "reproductivo", etiqueta: "Problemas reproductivos" },
  { valor: "accidente", etiqueta: "Accidente" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ETIQUETA_MOTIVO_BAJA = Object.fromEntries(MOTIVOS_BAJA.map((m) => [m.valor, m.etiqueta])) as Record<MotivoBaja, string>;
