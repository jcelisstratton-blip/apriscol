import { leerNumero } from "@/lib/numeros";
import { diasHasta, hoyBogota } from "@/lib/fechas";
import type { CandidataEmp, CriterioEmp, Empadronamiento, Especie } from "@/lib/tipos";

/** Duración típica de una temporada de monta (45 a 60 días). */
export const DURACION_DEFECTO_DIAS = 60;
export const DURACION_MAX_DIAS = 120;

/** Condición corporal: escala de 1 a 5, de medio en medio. */
export const VALORES_CC = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export const textoCC = (n: number | null) => (n == null ? "Sin dato" : String(n).replace(".", ","));

export type EstadoEmp = "abierto" | "cerrado";
export const estadoEmp = (e: Pick<Empadronamiento, "cerrado_en">): EstadoEmp => (e.cerrado_en ? "cerrado" : "abierto");

/** Cuánto va de la temporada: días corridos, total previsto y si ya pasó la fecha prevista de cierre. */
export function avanceEmp(e: Pick<Empadronamiento, "fecha_inicio" | "fecha_fin_prevista" | "cerrado_en">, hoy = hoyBogota()) {
  const total = Math.max(1, diasHasta(e.fecha_fin_prevista, e.fecha_inicio));
  const corridos = Math.min(Math.max(0, diasHasta(hoy, e.fecha_inicio)), 100000);
  const faltan = diasHasta(e.fecha_fin_prevista, hoy);
  return { total, corridos, faltan, atrasado: !e.cerrado_en && faltan < 0, pct: Math.min(100, Math.round((corridos / total) * 100)) };
}

/**
 * Qué se puede hacer con una candidata: `apta` (cumple todo), `verificar` (algún dato falta: se puede agregar y revisar) o
 * `no` (no cumple un criterio, ya está servida o gestante, o está en otro empadronamiento abierto).
 */
export type Aptitud = { clase: "apta" | "verificar" | "no"; motivos: string[] };

export function aptitud(c: CandidataEmp): Aptitud {
  const motivosNo: string[] = [];
  if (c.otro_lote) motivosNo.push(`Está en «${c.otro_lote}»`);
  if (c.estado_repro === "gestante") motivosNo.push("Está gestante");
  if (c.estado_repro === "servida") motivosNo.push("Ya fue servida");
  if (c.edad_ok === "no") motivosNo.push("Edad por debajo del mínimo");
  if (c.peso_ok === "no") motivosNo.push("Peso por debajo del mínimo");
  if (c.cc_ok === "no") motivosNo.push("Condición corporal por debajo del mínimo");
  if (motivosNo.length > 0) return { clase: "no", motivos: motivosNo };
  const faltan: string[] = [];
  const falta = (k: CriterioEmp, texto: string) => k === "sin_dato" && faltan.push(texto);
  falta(c.edad_ok, "Sin fecha de nacimiento");
  falta(c.peso_ok, "Sin peso");
  falta(c.cc_ok, "Sin condición corporal");
  return faltan.length > 0 ? { clase: "verificar", motivos: faltan } : { clase: "apta", motivos: [] };
}

export const textoEdad = (meses: number | null) => (meses == null ? "Sin dato" : meses < 24 ? `${meses} ${meses === 1 ? "mes" : "meses"}` : `${Math.floor(meses / 12)} años`);

/**
 * Hembras por semental que se recomiendan (monta natural). Referencias de extensión: cabros de 1 a 2 años, 15 a 20 hembras (Kentucky State
 * University); cabros adultos, 20 a 30 (NC State) y hasta 40 los probados; carneros adultos y de un año, unas 35 ovejas; carnero corderito,
 * 25 a 30. Aquí se usa el valor prudente de cada rango. Es una guía: la temporada puede fijar su propio número.
 */
export const RELACION_RECOMENDADA: Record<Especie, { joven: number; adulto: number; edadAdultoMeses: number }> = {
  caprino: { joven: 20, adulto: 30, edadAdultoMeses: 24 },
  ovino: { joven: 25, adulto: 35, edadAdultoMeses: 12 },
};

export type Capacidad = { max: number; origen: "fijada" | "joven" | "adulto" };

/** Cuántas hembras puede atender un semental en la temporada: el número que fijó la temporada o el recomendado por especie y edad (sin edad se toma el del joven, que es el prudente). */
export function capacidadSemental(especie: Especie, edadMeses: number | null, fijada: number | null): Capacidad {
  if (fijada != null) return { max: fijada, origen: "fijada" };
  const r = RELACION_RECOMENDADA[especie];
  return edadMeses != null && edadMeses >= r.edadAdultoMeses ? { max: r.adulto, origen: "adulto" } : { max: r.joven, origen: "joven" };
}

/** Meses cumplidos desde un nacimiento (nulo si no se sabe). */
export function mesesDesde(nacimiento: string | null, hoy = hoyBogota()): number | null {
  if (!nacimiento) return null;
  const a = new Date(`${nacimiento}T12:00:00Z`);
  const b = new Date(`${hoy}T12:00:00Z`);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/** El número de hembras que escribe la persona: entero de 1 a 100 (nulo si no lo es). */
export function leerNumeroHembras(texto: string): number | null {
  const n = leerNumero(texto);
  return n != null && Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

export const ETIQUETA_CAPACIDAD = { fijada: "fijado en la temporada", joven: "macho joven", adulto: "macho adulto" } as const;

// ───────────────────────── Filtro por fechas del resumen ─────────────────────────
// El filtro por periodos es de todos los menús (ver `lib/periodos.ts`); estos nombres se conservan para el resumen de empadronamientos.
export { PERIODOS as PERIODOS_EMP, esPeriodo as esPeriodoEmp, rangoPeriodo, type Periodo as PeriodoEmp } from "@/lib/periodos";
