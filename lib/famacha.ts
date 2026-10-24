import { diasHasta } from "@/lib/fechas";

/** Desde qué edad se evalúa: antes de los 3 meses la cría aún mama y la anemia por parásitos no es el problema. */
export const DIAS_EDAD_FAMACHA = 90;

export const PUNTAJES_FAMACHA = [1, 2, 3, 4, 5] as const;

/** Cómo se ve la mucosa del ojo en cada puntaje, y qué hacer. */
export const FAMACHA: Record<number, { color: string; texto: string; tono: "ok" | "neutro" | "aviso" | "alerta"; accion: string }> = {
  1: { color: "Rojo intenso", texto: "Sin anemia", tono: "ok", accion: "No necesita desparasitante." },
  2: { color: "Rojo rosado", texto: "Sin anemia", tono: "ok", accion: "No necesita desparasitante." },
  3: { color: "Rosado", texto: "Anemia leve", tono: "aviso", accion: "Vigílalo: evalúalo de nuevo en una o dos semanas. Desparasita si está flaco, recién parido o en lactancia." },
  4: { color: "Rosado pálido", texto: "Anemia", tono: "alerta", accion: "Conviene desparasitarlo." },
  5: { color: "Blanco", texto: "Anemia grave", tono: "alerta", accion: "Desparasítalo ya y consulta al veterinario: está en riesgo." },
};

export type EstadoFamacha = { clave: "al_dia" | "vigilar" | "desparasitar" | "tratado"; texto: string; tono: "ok" | "neutro" | "aviso" | "alerta" };

/** Qué toca hacer con un animal según su última evaluación y si ya se le desparasitó desde entonces. */
export function estadoFamacha(f: { puntaje: number; ultima_fecha: string; desparasitado_en: string | null }): EstadoFamacha {
  if (f.puntaje >= 4) {
    return f.desparasitado_en
      ? { clave: "tratado", texto: "Desparasitado: evalúalo de nuevo en 2 semanas", tono: "neutro" }
      : { clave: "desparasitar", texto: "Desparasitar", tono: "alerta" };
  }
  if (f.puntaje === 3) return f.desparasitado_en ? { clave: "tratado", texto: "Desparasitado: evalúalo de nuevo en 2 semanas", tono: "neutro" } : { clave: "vigilar", texto: "Vigilar", tono: "aviso" };
  return { clave: "al_dia", texto: "Sin anemia", tono: "ok" };
}

/** ¿Aplica evaluar a este animal? Activo y con al menos 3 meses (o sin fecha de nacimiento registrada). */
export function aplicaFamacha(a: { estado: string; fecha_nacimiento: string | null }, hoy: string): boolean {
  if (a.estado !== "activo") return false;
  if (!a.fecha_nacimiento) return true;
  return -diasHasta(a.fecha_nacimiento, hoy) >= DIAS_EDAD_FAMACHA;
}

/** Cuántos animales hay por desparasitar y cuántos por vigilar según su última evaluación. Una sola cuenta para todas las pantallas. */
export function contarFamacha(filas: { puntaje: number; ultima_fecha: string; desparasitado_en: string | null }[]): { desparasitar: number; vigilar: number } {
  const claves = filas.map((f) => estadoFamacha(f).clave);
  return { desparasitar: claves.filter((c) => c === "desparasitar").length, vigilar: claves.filter((c) => c === "vigilar").length };
}
