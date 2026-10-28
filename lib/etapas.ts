/**
 * Etapas de crecimiento de un animal y mezcla de etapas en un corral. Todo se calcula (nada se guarda) con la edad, el peso y los ajustes de la finca:
 * lactante hasta el destete; después, las hembras en levante hasta que están listas para la monta (edad y porcentaje del peso adulto, los mismos criterios
 * del primer servicio) y adultas; y los machos aparte desde el destete (levante, ceba, reproductor o adulto). Se usa el peso **relativo** al peso adulto de la
 * finca, no una tabla de kilos: una Saanen y una criolla crecen a ritmos distintos y la misma regla sirve para las dos.
 */
import type { Especie, SexoAnimal } from "@/lib/tipos";

export type Etapa = "lactante" | "levante_hembra" | "lista_monta" | "hembra_adulta" | "levante_macho" | "ceba" | "reproductor" | "macho_adulto";

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  lactante: "Lactante",
  levante_hembra: "Levante (hembra)",
  lista_monta: "Lista para monta",
  hembra_adulta: "Hembra adulta",
  levante_macho: "Levante (macho)",
  ceba: "Ceba",
  reproductor: "Reproductor",
  macho_adulto: "Macho adulto",
};
export const ORDEN_ETAPAS: Etapa[] = ["lactante", "levante_hembra", "lista_monta", "hembra_adulta", "levante_macho", "ceba", "reproductor", "macho_adulto"];

/** A partir de esta edad un animal ya se considera adulto, haya parido o no. */
export const MESES_ADULTO = 24;

export type EntradaEtapa = {
  sexo: SexoAnimal;
  /** Edad en días (null si no se conoce la fecha de nacimiento). */
  edadDias: number | null;
  /** Último peso (kg), si se pesó. */
  pesoKg: number | null;
  /** Ya tuvo partos (registrados o previos). */
  tienePartos?: boolean;
  usoMacho?: "reproductor" | "carne" | null;
  enLoteCeba?: boolean;
};

export type CriteriosEtapa = {
  desteteDias: number;
  /** Edad mínima del primer servicio, en meses (Ajustes → Reproducción). */
  servicioEdadMeses: number;
  /** Porcentaje del peso adulto para el primer servicio (Ajustes → Reproducción). */
  servicioPesoPct: number;
  /** Peso de una hembra adulta de la finca para esta especie (kg), si se conoce. */
  pesoAdultoKg: number | null;
};

/** La etapa de un animal, o null si no se sabe su edad. */
export function etapaDe(a: EntradaEtapa, c: CriteriosEtapa): Etapa | null {
  if (a.edadDias === null) return null;
  if (a.edadDias < c.desteteDias) return "lactante";
  const adulto = a.edadDias >= MESES_ADULTO * 30.4375;
  if (a.sexo === "hembra") {
    if (adulto || a.tienePartos) return "hembra_adulta";
    const edadOk = a.edadDias >= c.servicioEdadMeses * 30.4375;
    const pesoOk = a.pesoKg === null || c.pesoAdultoKg === null ? true : a.pesoKg >= (c.pesoAdultoKg * c.servicioPesoPct) / 100;
    return edadOk && pesoOk ? "lista_monta" : "levante_hembra";
  }
  if (a.usoMacho === "reproductor" && adulto) return "reproductor";
  if (a.enLoteCeba || a.usoMacho === "carne") return "ceba";
  if (adulto) return a.usoMacho === "reproductor" ? "reproductor" : "macho_adulto";
  return "levante_macho";
}

/** El porcentaje del peso adulto que ya alcanzó (0 a más de 100), o null si falta el peso o la referencia. */
export function porcentajePesoAdulto(pesoKg: number | null, pesoAdultoKg: number | null): number | null {
  if (pesoKg === null || pesoAdultoKg === null || pesoAdultoKg <= 0) return null;
  return Math.round((pesoKg / pesoAdultoKg) * 100);
}

/** Peso adulto de referencia: el que definió la finca o, si no, el promedio de sus hembras adultas pesadas (con al menos 3). */
export function pesoAdultoReferencia(definido: number | null, pesosAdultas: number[]): number | null {
  if (definido !== null) return definido;
  if (pesosAdultas.length < 3) return null;
  return Math.round((pesosAdultas.reduce((s, p) => s + p, 0) / pesosAdultas.length) * 10) / 10;
}

// ───────────────────────── Mezcla en un corral ─────────────────────────

export type OcupanteCorral = { id?: string; etapa: Etapa | null; sexo: SexoAnimal; pesoKg: number | null };
export type AvisoMezcla = {
  clave: "lactantes_con_grandes" | "machos_con_hembras" | "pesos_distintos";
  texto: string;
  /** Quiénes son los animales del aviso (si los ocupantes traen su id): para filtrar la lista del corral y verlos. */
  ver?: { texto: string; ids: string[] };
};
const idsDe = (xs: OcupanteCorral[]) => xs.map((o) => o.id).filter((i): i is string => Boolean(i));

/** Los corrales donde la mezcla es lo normal: no se avisa. */
export const USOS_SIN_AVISO_MEZCLA = ["maternidad"] as const;
/** Donde conviven machos y hembras a propósito (monta). */
export const USOS_CON_MACHOS = ["reproductoras"] as const;

/**
 * Qué conviene revisar en un corral según quiénes están (o quiénes van a estar). Son recomendaciones, nunca un bloqueo: el manejo lo decide la persona.
 *  · lactantes con animales ya destetados: los más chicos quedan desplazados del alimento;
 *  · machos destetados con hembras (salvo reproductores y corrales de monta): se separan al terminar la lactancia para evitar montas tempranas;
 *  · mucha diferencia de peso: el más pesado desplaza al más liviano.
 */
export function avisosMezcla(ocupantes: OcupanteCorral[], uso: string, razonPeso: number): AvisoMezcla[] {
  if ((USOS_SIN_AVISO_MEZCLA as readonly string[]).includes(uso)) return [];
  const avisos: AvisoMezcla[] = [];
  const lactantes = ocupantes.filter((o) => o.etapa === "lactante");
  const destetados = ocupantes.filter((o) => o.etapa !== null && o.etapa !== "lactante");
  if (lactantes.length > 0 && destetados.length > 0) {
    avisos.push({
      clave: "lactantes_con_grandes",
      texto: `Hay ${lactantes.length} ${lactantes.length === 1 ? "lactante" : "lactantes"} con ${destetados.length} ${destetados.length === 1 ? "animal ya destetado" : "animales ya destetados"}: los más chicos quedan desplazados del alimento.`,
      ver: { texto: `Ver ${lactantes.length === 1 ? "el lactante" : `los ${lactantes.length} lactantes`}`, ids: idsDe(lactantes) },
    });
  }
  if (!(USOS_CON_MACHOS as readonly string[]).includes(uso)) {
    const machos = destetados.filter((o) => o.sexo === "macho" && o.etapa !== "reproductor");
    const hembras = destetados.filter((o) => o.sexo === "hembra");
    if (machos.length > 0 && hembras.length > 0) {
      avisos.push({
        clave: "machos_con_hembras",
        texto: `Hay ${machos.length} ${machos.length === 1 ? "macho" : "machos"} destetados con ${hembras.length} ${hembras.length === 1 ? "hembra" : "hembras"}: conviene separarlos después de la lactancia para evitar montas tempranas.`,
        ver: { texto: `Ver ${machos.length === 1 ? "el macho" : `los ${machos.length} machos`}`, ids: idsDe(machos) },
      });
    }
  }
  const pesados = destetados.filter((o) => o.pesoKg !== null && o.pesoKg > 0);
  const pesos = pesados.map((o) => o.pesoKg as number);
  if (pesos.length >= 2) {
    const max = Math.max(...pesos);
    const min = Math.min(...pesos);
    if (max / min > razonPeso) {
      const n = (v: number) => v.toLocaleString("es-CO", { maximumFractionDigits: 1 });
      const extremos = pesados.filter((o) => o.pesoKg === max || o.pesoKg === min);
      avisos.push({ clave: "pesos_distintos", ver: { texto: "Ver el más pesado y el más liviano", ids: idsDe(extremos) }, texto: `El más pesado (${n(max)} kg) pesa ${n(Math.round((max / min) * 10) / 10)} veces el más liviano (${n(min)} kg): el grande desplaza al pequeño.` });
    }
  }
  return avisos;
}

/** Cuántos animales hay de cada etapa, en el orden del ciclo. Los de edad desconocida se cuentan aparte. */
export function contarEtapas(ocupantes: { etapa: Etapa | null }[]): { etapa: Etapa; n: number }[] {
  return ORDEN_ETAPAS.map((etapa) => ({ etapa, n: ocupantes.filter((o) => o.etapa === etapa).length })).filter((x) => x.n > 0);
}

export const ESPECIES_ETAPA: Especie[] = ["caprino", "ovino"];
