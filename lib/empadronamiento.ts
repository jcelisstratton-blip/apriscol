import { diasHasta, hoyBogota } from "@/lib/fechas";
import type { CandidataEmp, CriterioEmp, Empadronamiento, Especie } from "@/lib/tipos";

/**
 * Criterios orientativos para elegir las hembras de una temporada de monta. No son una norma: cada empadronamiento guarda los suyos y se
 * ajustan según la raza y el sistema de la finca.
 */
export const CRITERIOS_POR_DEFECTO: Record<Especie, { edadMeses: number; pesoKg: number; cc: number }> = {
  caprino: { edadMeses: 8, pesoKg: 30, cc: 3 },
  ovino: { edadMeses: 8, pesoKg: 35, cc: 3 },
};

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
