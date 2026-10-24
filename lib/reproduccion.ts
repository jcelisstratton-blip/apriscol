import { diasDesde, diasHasta, sumarDias } from "@/lib/fechas";
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

/** Las crías de un parto en una línea: «1 cría viva», «2 crías · 1 viva · 1 muerta». Vacío si no hay crías (un aborto). */
export function resumenCrias(crias: { vivo: boolean }[]): string {
  const n = crias.length;
  if (n === 0) return "";
  const vivas = crias.filter((c) => c.vivo).length;
  const muertas = n - vivas;
  const texto = (k: number, f: string) => (k === 1 ? `1 ${f}` : `${k} ${f === "viva" ? "vivas" : "muertas"}`);
  if (muertas === 0) return `${n === 1 ? "1 cría" : `${n} crías`} ${n === 1 ? "viva" : "vivas"}`;
  if (vivas === 0) return `${n === 1 ? "1 cría" : `${n} crías`} ${n === 1 ? "muerta" : "muertas"}`;
  return `${n} crías · ${texto(vivas, "viva")} · ${texto(muertas, "muerta")}`;
}

/** Partos totales en texto: «3 partos», «1 parto» o «Sin dato». */
export const textoPartos = (n: number | null) => (n == null ? "Sin dato" : n === 1 ? "1 parto" : `${n} partos`);

export const MAX_CRIAS = 8;

// ───────────────────────── Reglas de seguimiento (una sola definición para el Resumen, la ficha y los reportes) ─────────────────────────
/** Cuántos días hacia adelante cuenta un parto como «próximo». */
export const DIAS_PARTO_PROXIMO = 45;

export type Etapa = "primer_tercio" | "segundo_tercio" | "ultimo_tercio";
export const ETIQUETA_ETAPA: Record<Etapa, string> = { primer_tercio: "Primer tercio", segundo_tercio: "Segundo tercio", ultimo_tercio: "Último tercio" };

/** En qué parte de la gestación va una hembra. El último tercio empieza el día que la finca definió en sus Ajustes. */
export function etapaGestacion(diasGestados: number, gestacionDias: number, ultimoTercioDia: number): Etapa {
  if (diasGestados >= ultimoTercioDia) return "ultimo_tercio";
  if (diasGestados >= Math.floor(gestacionDias / 3)) return "segundo_tercio";
  return "primer_tercio";
}

export type SituacionDiagnostico = "pronto" | "toca" | "atrasado";

/**
 * Qué toca con una hembra servida que aún no tiene diagnóstico: todavía es pronto, ya toca (dentro de la ventana de la finca) o el
 * diagnóstico va tarde. `dias` son los días desde el servicio; la ventana (desde, hasta) sale de los Ajustes.
 */
export function situacionDiagnostico(dias: number, desde: number, hasta: number): SituacionDiagnostico {
  if (dias < desde) return "pronto";
  if (dias <= hasta) return "toca";
  return "atrasado";
}

/** Cuántos días de gestación lleva y cuántos dura en total, a partir de la fecha del servicio y la fecha prevista de parto. */
export function avanceGestacion(servicio: string, prevista: string, hoy: string): { gestados: number; total: number } {
  return { gestados: Math.max(0, diasDesde(servicio, hoy)), total: Math.max(1, diasHasta(prevista, servicio)) };
}

/** Qué pasó con un servicio, para medir la tasa de preñez de un reproductor o de un tipo de servicio. */
export type ResultadoServicio = "parto" | "aborto" | "gestante" | "vacia" | "pendiente";

/**
 * El resultado de un servicio: lo que registró el parto manda sobre el diagnóstico (si parió, quedó preñada aunque nunca se diagnosticara);
 * sin parto, vale el último diagnóstico. Un diagnóstico dudoso o ninguno deja el servicio pendiente.
 */
export function resultadoServicio(parto: "normal" | "asistido" | "cesarea" | "aborto" | null, ultimoDiagnostico: "gestante" | "vacia" | "dudoso" | null): ResultadoServicio {
  if (parto === "aborto") return "aborto";
  if (parto) return "parto";
  if (ultimoDiagnostico === "gestante") return "gestante";
  if (ultimoDiagnostico === "vacia") return "vacia";
  return "pendiente";
}

/** Un servicio «resuelto» es el que ya se sabe si preñó o no; la tasa de preñez solo cuenta esos. */
export const servicioResuelto = (r: ResultadoServicio) => r !== "pendiente";
/** Quedó preñada: parió, abortó o está confirmada gestante. */
export const servicioPreno = (r: ResultadoServicio) => r === "parto" || r === "aborto" || r === "gestante";


type FilaRepro = Pick<ReproHembra, "estado" | "diagnostico" | "fecha_diagnostico" | "ultimo_servicio" | "fecha_prevista_parto" | "en_lactancia">;
/** La ventana del diagnóstico de gestación según los Ajustes de la finca: desde y hasta qué día después del servicio. */
export type VentanaDx = { desde: number; hasta: number };

const enGestacion = (f: Pick<FilaRepro, "estado">) => f.estado === "gestante" || f.estado === "servida";

/** Pare en los próximos `DIAS_PARTO_PROXIMO` días (o lo debió hacer hace poco, sin pasar de `DIAS_PARTO_ATRASADO`). */
export function partoProximo(f: Pick<FilaRepro, "estado" | "fecha_prevista_parto">, hoy: string): boolean {
  if (!enGestacion(f) || !f.fecha_prevista_parto) return false;
  const d = diasHasta(f.fecha_prevista_parto, hoy);
  return d >= -DIAS_PARTO_ATRASADO && d <= DIAS_PARTO_PROXIMO;
}

/** Pasó su fecha prevista por más de `DIAS_PARTO_ATRASADO` días sin parir. */
export const partoAtrasado = (f: Pick<FilaRepro, "estado" | "fecha_prevista_parto">, hoy: string): boolean =>
  enGestacion(f) && Boolean(f.fecha_prevista_parto) && diasHasta(f.fecha_prevista_parto!, hoy) < -DIAS_PARTO_ATRASADO;

/** Gestante confirmada que ya entró al último tercio (según el día que fijó la finca) y aún no pare: conviene reforzar la alimentación. */
export const enUltimoTercio = (f: Pick<FilaRepro, "estado" | "ultimo_servicio" | "fecha_prevista_parto">, hoy: string, ultimoTercioDia: number): boolean =>
  f.estado === "gestante" && Boolean(f.ultimo_servicio) && Boolean(f.fecha_prevista_parto) && diasDesde(f.ultimo_servicio!, hoy) >= ultimoTercioDia && diasHasta(f.fecha_prevista_parto!, hoy) >= 0;

/** Gestante confirmada, en lactancia y a `diasAntes` días del parto o menos: llegó el momento de secarla. */
export const porSecar = (f: Pick<FilaRepro, "estado" | "en_lactancia" | "fecha_prevista_parto">, hoy: string, diasAntes: number): boolean =>
  f.estado === "gestante" && f.en_lactancia && Boolean(f.fecha_prevista_parto) && diasHasta(f.fecha_prevista_parto!, hoy) <= diasAntes;

export type SeguimientoServida = {
  /** «diagnostico» si aún no se ha diagnosticado; «repetir» si el último diagnóstico fue dudoso. */
  clase: "diagnostico" | "repetir";
  estado: SituacionDiagnostico;
  /** Días desde el servicio (o desde el diagnóstico dudoso, si hay que repetirlo). */
  dias: number;
  /** La ventana en que toca, como fechas. */
  desde: string;
  hasta: string;
};

/**
 * Qué toca con una hembra servida: confirmar su gestación con un diagnóstico (ventana de los Ajustes) o repetir uno dudoso (14 a 21 días después).
 * `null` si no está servida. «pronto» = todavía no; «toca» = dentro de la ventana; «atrasado» = pasó la ventana.
 */
export function seguimientoServida(f: FilaRepro, hoy: string, ventana: VentanaDx): SeguimientoServida | null {
  if (f.estado !== "servida" || !f.ultimo_servicio) return null;
  if (enObservacion(f)) {
    const dias = diasDesde(f.fecha_diagnostico!, hoy);
    const v = ventanaRepetirDx(f.fecha_diagnostico!);
    return { clase: "repetir", estado: situacionDiagnostico(dias, DIAS_REPETIR_DX_DESDE, DIAS_REPETIR_DX_HASTA), dias, desde: v.desde, hasta: v.hasta };
  }
  const dias = diasDesde(f.ultimo_servicio, hoy);
  return { clase: "diagnostico", estado: situacionDiagnostico(dias, ventana.desde, ventana.hasta), dias, desde: sumarDias(f.ultimo_servicio, ventana.desde), hasta: sumarDias(f.ultimo_servicio, ventana.hasta) };
}

/** Servida a la que ya toca (o va tarde) confirmarle la gestación. */
export const porConfirmar = (f: FilaRepro, hoy: string, ventana: VentanaDx): boolean => {
  const s = seguimientoServida(f, hoy, ventana);
  return s?.clase === "diagnostico" && s.estado !== "pronto";
};

/** Diagnóstico dudoso al que ya toca (o va tarde) repetirle la prueba. */
export const porRepetir = (f: FilaRepro, hoy: string, ventana: VentanaDx): boolean => {
  const s = seguimientoServida(f, hoy, ventana);
  return s?.clase === "repetir" && s.estado !== "pronto";
};
