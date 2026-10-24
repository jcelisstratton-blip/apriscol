import { diasHasta } from "@/lib/fechas";
import { sumarDias } from "@/lib/fechas";
import type { EstadoRepro, IndicadorPalpacion, MetodoDiagnostico, ReproHembra, ResultadoDiagnostico, TecnicaInseminacion, CausaAborto, TipoParto, TipoServicio, TipoTransferencia, ViabilidadFetal } from "@/lib/tipos";

export const TIPOS_SERVICIO: TipoServicio[] = ["monta_natural", "inseminacion", "transferencia_embrionaria"];
export const ETIQUETA_SERVICIO: Record<TipoServicio, string> = {
  monta_natural: "Monta natural",
  inseminacion: "Inseminación",
  transferencia_embrionaria: "Transferencia de embrión",
};

export const TECNICAS_INSEMINACION: TecnicaInseminacion[] = ["cervical", "transcervical", "laparoscopica"];
export const ETIQUETA_TECNICA: Record<TecnicaInseminacion, string> = { cervical: "Cervical", transcervical: "Transcervical", laparoscopica: "Laparoscópica" };
export const DETALLE_TECNICA: Record<TecnicaInseminacion, string> = {
  cervical: "El semen se deposita a la entrada del cuello uterino.",
  transcervical: "Se pasa el cuello uterino y se deposita dentro del útero.",
  laparoscopica: "Con cirugía menor, directo en el útero.",
};

export const TIPOS_TRANSFERENCIA: TipoTransferencia[] = ["fresco", "vitrificado", "congelado"];
export const ETIQUETA_TRANSFERENCIA: Record<TipoTransferencia, string> = { fresco: "Fresco", vitrificado: "Vitrificado", congelado: "Congelado" };
export const DETALLE_TRANSFERENCIA: Record<TipoTransferencia, string> = {
  fresco: "Se transfiere recién recolectado.",
  vitrificado: "Congelado ultrarrápido, listo para descongelar.",
  congelado: "Congelación lenta tradicional.",
};

export const METODOS_DIAGNOSTICO: MetodoDiagnostico[] = ["ecografia", "palpacion", "otro"];
export const DETALLE_METODO: Record<MetodoDiagnostico, string> = { ecografia: "Se ve el feto y su latido.", palpacion: "Revisión manual o señales del animal.", otro: "Prueba de laboratorio u hormonal." };
export const DETALLE_RESULTADO: Record<ResultadoDiagnostico, string> = { gestante: "Pasa a gestante y se proyecta el parto.", vacia: "Vuelve a estar disponible para un nuevo ciclo.", dudoso: "Queda en observación: se repite la prueba." };

export const FETOS: number[] = [1, 2, 3, 4];
export const ETIQUETA_FETOS: Record<number, string> = { 1: "Único", 2: "Mellizos", 3: "Trillizos", 4: "Cuatro o más" };
export const DETALLE_FETOS: Record<number, string> = { 1: "Un feto.", 2: "Dos fetos.", 3: "Tres fetos.", 4: "Cuatro fetos." };

export const VIABILIDADES: ViabilidadFetal[] = ["latido", "sin_actividad"];
export const ETIQUETA_VIABILIDAD: Record<ViabilidadFetal, string> = { latido: "Latido presente", sin_actividad: "Sin actividad" };
export const DETALLE_VIABILIDAD: Record<ViabilidadFetal, string> = { latido: "El feto está vivo.", sin_actividad: "No se ve latido." };

export const INDICADORES_PALPACION: IndicadorPalpacion[] = ["ausencia_celo", "retorno_celo", "llenado_uterino", "revision_manual"];
export const ETIQUETA_INDICADOR: Record<IndicadorPalpacion, string> = { ausencia_celo: "No volvió a celo", retorno_celo: "Retornó al celo", llenado_uterino: "Llenado uterino", revision_manual: "Revisión manual" };
export const DETALLE_INDICADOR: Record<IndicadorPalpacion, string> = {
  ausencia_celo: "Pasó el ciclo sin señales de celo.",
  retorno_celo: "Volvió a mostrar celo: no quedó gestante.",
  llenado_uterino: "Se siente el útero lleno por palpación.",
  revision_manual: "Palpación abdominal u otra revisión a mano.",
};

/** Cuántos días después de un diagnóstico dudoso conviene repetirlo (desde, hasta). */
export const DIAS_REPETIR_DX_DESDE = 14;
export const DIAS_REPETIR_DX_HASTA = 21;

/** Ventana para repetir un diagnóstico dudoso: se calcula con la fecha del diagnóstico, no se guarda. */
export const ventanaRepetirDx = (fechaDx: string) => ({ desde: sumarDias(fechaDx, DIAS_REPETIR_DX_DESDE), hasta: sumarDias(fechaDx, DIAS_REPETIR_DX_HASTA) });

/** Hembra servida cuyo último diagnóstico (de este servicio) fue «dudoso»: sigue en observación hasta repetirlo. */
export const enObservacion = (f: Pick<ReproHembra, "estado" | "diagnostico" | "fecha_diagnostico" | "ultimo_servicio">) =>
  f.estado === "servida" && f.diagnostico === "dudoso" && Boolean(f.fecha_diagnostico && f.ultimo_servicio && f.fecha_diagnostico >= f.ultimo_servicio);

/** Un servicio sigue «activo» mientras no haya un parto o aborto de la hembra en su fecha o después. */
export const servicioEsActivo = (fechaServicio: string, fechaUltimoParto: string | null) => !fechaUltimoParto || fechaServicio > fechaUltimoParto;

export const ETIQUETA_METODO: Record<MetodoDiagnostico, string> = { ecografia: "Ecografía", palpacion: "Palpación", otro: "Otro método" };

export const RESULTADOS_DIAGNOSTICO: ResultadoDiagnostico[] = ["gestante", "vacia", "dudoso"];
export const ETIQUETA_RESULTADO: Record<ResultadoDiagnostico, string> = { gestante: "Gestante", vacia: "Vacía", dudoso: "Dudoso" };

export const TIPOS_PARTO: TipoParto[] = ["normal", "asistido", "cesarea", "aborto"];
export const ETIQUETA_PARTO: Record<TipoParto, string> = { normal: "Parto normal", asistido: "Parto asistido", cesarea: "Cesárea", aborto: "Aborto" };

export const DETALLE_PARTO: Record<TipoParto, string> = {
  normal: "Sin ayuda: nació por sí sola.",
  asistido: "Hubo que ayudarla a parir.",
  cesarea: "Intervención quirúrgica.",
  aborto: "Pérdida de la gestación, sin crías.",
};

export const CAUSAS_ABORTO: CausaAborto[] = ["infecciosa", "nutricional", "traumatica", "toxica", "desconocida"];
export const ETIQUETA_CAUSA: Record<CausaAborto, string> = { infecciosa: "Infecciosa", nutricional: "Nutricional", traumatica: "Trauma o estrés", toxica: "Tóxica o medicamentos", desconocida: "Desconocida" };
export const DETALLE_CAUSA: Record<CausaAborto, string> = {
  infecciosa: "Sospecha de bacterias, virus o parásitos.",
  nutricional: "Falta o exceso de alimento o minerales.",
  traumatica: "Golpes, peleas, transporte o manejo brusco.",
  toxica: "Plantas, moho o un medicamento.",
  desconocida: "No se sabe todavía.",
};

export const ETIQUETA_ESTADO: Record<EstadoRepro, string> = { sin_datos: "Sin datos", vacia: "Vacía", servida: "Servida", gestante: "Gestante" };
export const ETIQUETA_OBSERVACION = "En observación";
export const TONO_ESTADO: Record<EstadoRepro, "neutro" | "aviso" | "ok" | "musgo"> = { sin_datos: "neutro", vacia: "neutro", servida: "aviso", gestante: "musgo" };

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

/** Lo propio del evento en una línea: la causa de un aborto y quién asistió. */
export function detalleParto(p: { tipo: TipoParto; causa_aborto: CausaAborto | null; asistido_por: string | null }): string | undefined {
  const partes = [p.tipo === "aborto" && p.causa_aborto && `Causa ${ETIQUETA_CAUSA[p.causa_aborto].toLowerCase()}`, p.asistido_por && `Asistió ${p.asistido_por}`].filter(Boolean);
  return partes.length ? partes.join(" · ") : undefined;
}

/** Partos totales en texto: «3 partos», «1 parto» o «Sin dato». */
export const textoPartos = (n: number | null) => (n == null ? "Sin dato" : n === 1 ? "1 parto" : `${n} partos`);

export const MAX_CRIAS = 8;
