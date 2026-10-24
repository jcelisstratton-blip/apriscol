import { diasHasta } from "@/lib/fechas";
import type { SexoAnimal } from "@/lib/tipos";

/**
 * Cálculos puros de los reportes (sin base de datos), para poder probarlos con casos reales. Los umbrales que dependen de cada finca
 * (edad mínima de servicio, días del diagnóstico, ganancia mínima) llegan de sus Ajustes; los demás son constantes con su razón.
 */

/** Hasta qué edad una cabrita u ovejita es «cría»: el destete se hace hacia los 3 o 4 meses. */
export const EDAD_DESTETE_MESES = 4;

export type Categoria = "cria" | "levante" | "hembra_adulta" | "macho_adulto" | "sin_edad";
export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  cria: "Cría",
  levante: "Levante",
  hembra_adulta: "Hembra adulta",
  macho_adulto: "Macho adulto",
  sin_edad: "Sin fecha de nacimiento",
};
/** El orden en que se listan. */
export const ORDEN_CATEGORIA: Categoria[] = ["hembra_adulta", "macho_adulto", "levante", "cria", "sin_edad"];

/** Meses cumplidos entre dos fechas (AAAA-MM-DD). `null` si falta la de nacimiento. */
export function mesesEntre(desde: string | null, hasta: string): number | null {
  if (!desde) return null;
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(0, meses);
}

/**
 * En qué grupo está un animal por su edad: cría (hasta el destete), levante (hasta la edad mínima de servicio de la finca) y adulto.
 * Sin fecha de nacimiento no se adivina: queda aparte para que se complete el dato.
 */
export function categoriaAnimal(a: { sexo: SexoAnimal; fecha_nacimiento: string | null }, edadServicioMeses: number, hoy: string): Categoria {
  const meses = mesesEntre(a.fecha_nacimiento, hoy);
  if (meses === null) return "sin_edad";
  if (meses < EDAD_DESTETE_MESES) return "cria";
  if (meses < edadServicioMeses) return "levante";
  return a.sexo === "hembra" ? "hembra_adulta" : "macho_adulto";
}

/** Días entre una fecha pasada y hoy (positivo si ya pasó). */
export const diasDesde = (fecha: string, hoy: string) => -diasHasta(fecha, hoy);

// ───────────────────────── Reproducción ─────────────────────────
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

// ───────────────────────── Peso y condición corporal ─────────────────────────
/** Días sin pesar a partir de los cuales un animal se marca. */
export const DIAS_SIN_PESAR = 90;
/** Menos de estos días entre dos pesajes la ganancia diaria no es confiable (un error de la báscula pesa mucho). */
export const DIAS_MINIMOS_GDP = 7;
/** Condición corporal (escala 1 a 5): por debajo está flaca, por encima engrasada. */
export const CC_BAJA = 2.5;
export const CC_ALTA = 3.5;

export type BandaCC = "baja" | "adecuada" | "alta";
export const bandaCondicion = (cc: number): BandaCC => (cc < CC_BAJA ? "baja" : cc > CC_ALTA ? "alta" : "adecuada");

/** Ganancia diaria de peso en gramos entre dos pesajes; `null` si están muy cerca en el tiempo o falta el anterior. */
export function gananciaDiariaG(actual: { fecha: string; kg: number }, anterior: { fecha: string; kg: number } | null): number | null {
  if (!anterior) return null;
  const dias = diasDesde(anterior.fecha, actual.fecha);
  if (dias < DIAS_MINIMOS_GDP) return null;
  return Math.round(((actual.kg - anterior.kg) / dias) * 1000);
}

// ───────────────────────── Estadística simple ─────────────────────────
export const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
/** Promedio, o `null` si no hay datos (nunca se inventa un cero). */
export const promedio = (xs: number[]): number | null => (xs.length === 0 ? null : suma(xs) / xs.length);
/** `parte / total` como proporción 0..1, o `null` si el total es cero. */
export const proporcion = (parte: number, total: number): number | null => (total > 0 ? parte / total : null);

/** Orden natural por arete: «A-2» antes de «A-10». */
export const compararArete = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
