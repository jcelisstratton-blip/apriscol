import { litros } from "@/lib/fechas";

export type NivelTendencia = "normal" | "alerta" | "critico" | "sin_datos";
export type Tendencia = {
  animal_id: string;
  litros_base: number | null;
  litros_recientes: number | null;
  dias_base: number;
  dias_recientes: number;
  variacion: number | null;
  nivel: NivelTendencia;
};

/** Una tendencia que merece atención: la producción de la hembra viene bajando. */
export type TendenciaBaja = Tendencia & { nivel: "alerta" | "critico"; variacion: number };

export const esBaja = (t: Tendencia): t is TendenciaBaja => (t.nivel === "alerta" || t.nivel === "critico") && t.variacion !== null;

export const porcentajeBaja = (variacion: number) => Math.round(Math.abs(variacion) * 100);

/** «Bajó 32 % en los últimos 3 días: de 2 a 1,4 L al día.» */
export function mensajeBaja(t: TendenciaBaja): string {
  return `Bajó ${porcentajeBaja(t.variacion)} % en los últimos 3 días: de ${litros(t.litros_base)} a ${litros(t.litros_recientes)} L al día.`;
}

export const CONSEJO_BAJA =
  "Revisa qué le pasa: su salud (mastitis, parásitos), si está comiendo y tomando agua, y si está en celo o con estrés.";

export const ETIQUETA_NIVEL_BAJA = { alerta: "Baja producción", critico: "Revisar ya" } as const;

/** Con menos del 70 % de lo habitual en una jornada, vale la pena avisar en el momento del ordeño. */
export const FRACCION_MUY_BAJA = 0.7;
