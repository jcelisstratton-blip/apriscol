import { diasHasta } from "@/lib/fechas";
import type { EstadoRepro, MetodoDiagnostico, ResultadoDiagnostico, TipoParto, TipoServicio } from "@/lib/tipos";

export const TIPOS_SERVICIO: TipoServicio[] = ["monta_natural", "inseminacion", "transferencia_embrionaria"];
export const ETIQUETA_SERVICIO: Record<TipoServicio, string> = {
  monta_natural: "Monta natural",
  inseminacion: "Inseminación",
  transferencia_embrionaria: "Transferencia de embrión",
};

export const METODOS_DIAGNOSTICO: MetodoDiagnostico[] = ["ecografia", "palpacion", "otro"];
export const ETIQUETA_METODO: Record<MetodoDiagnostico, string> = { ecografia: "Ecografía", palpacion: "Palpación", otro: "Otro método" };

export const RESULTADOS_DIAGNOSTICO: ResultadoDiagnostico[] = ["gestante", "vacia", "dudoso"];
export const ETIQUETA_RESULTADO: Record<ResultadoDiagnostico, string> = { gestante: "Gestante", vacia: "Vacía", dudoso: "Dudoso" };

export const TIPOS_PARTO: TipoParto[] = ["normal", "asistido", "cesarea", "aborto"];
export const ETIQUETA_PARTO: Record<TipoParto, string> = { normal: "Parto normal", asistido: "Parto asistido", cesarea: "Cesárea", aborto: "Aborto" };

export const ETIQUETA_ESTADO: Record<EstadoRepro, string> = { sin_datos: "Sin datos", vacia: "Vacía", servida: "Servida", gestante: "Gestante" };
export const TONO_ESTADO: Record<EstadoRepro, "neutro" | "aviso" | "ok" | "musgo"> = { sin_datos: "neutro", vacia: "neutro", servida: "aviso", gestante: "musgo" };

/** Desde cuántos días de un servicio sin diagnóstico conviene confirmar si quedó gestante (ecografía desde ~30–45 días). */
export const DIAS_PARA_DIAGNOSTICO = 45;
/** Cuántos días pasada la fecha prevista sin parto se marca como atrasada. */
export const DIAS_PARTO_ATRASADO = 7;

export type PlazoParto = { texto: string; tono: "ok" | "aviso" | "alerta" | "neutro" };

/** Cuánto falta para el parto previsto (o cuánto lleva de atraso). */
export function plazoParto(prevista: string, hoy: string): PlazoParto {
  const d = diasHasta(prevista, hoy);
  if (d < -DIAS_PARTO_ATRASADO) return { texto: `Atrasada ${-d} días`, tono: "alerta" };
  if (d < 0) return { texto: d === -1 ? "Debió parir ayer" : `Debió parir hace ${-d} días`, tono: "aviso" };
  if (d === 0) return { texto: "Pare hoy", tono: "aviso" };
  if (d <= 14) return { texto: d === 1 ? "Pare mañana" : `Pare en ${d} días`, tono: "aviso" };
  return { texto: `Pare en ${d} días`, tono: "ok" };
}

/** Partos totales en texto: «3 partos», «1 parto» o «Sin dato». */
export const textoPartos = (n: number | null) => (n == null ? "Sin dato" : n === 1 ? "1 parto" : `${n} partos`);

export const MAX_CRIAS = 8;
