import { diasHasta } from "@/lib/fechas";

/** Desde qué edad se evalúa: antes de los 3 meses la cría aún mama y la anemia por parásitos no es el problema. */
export const DIAS_EDAD_FAMACHA = 90;

export const PUNTAJES_FAMACHA = [1, 2, 3, 4, 5] as const;

/** Cómo se ve la mucosa del ojo en cada puntaje, y qué hacer. */
export const FAMACHA: Record<number, { color: string; texto: string; tono: "ok" | "neutro" | "aviso" | "alerta"; accion: string; detalle: string; mucosa: string }> = {
  1: { color: "Rojo intenso", texto: "Sin anemia", tono: "ok", detalle: "Rojo vivo o rosado muy oscuro. Mucosa sana y bien irrigada.", mucosa: "#c4303b", accion: "No necesita desparasitante." },
  2: { color: "Rojo rosado", texto: "Sin anemia", tono: "ok", detalle: "Rosado, un poco menos intenso de lo normal, pero todavía con buen color.", mucosa: "#e0626f", accion: "No necesita desparasitante." },
  3: { color: "Rosado", texto: "Anemia leve", tono: "aviso", detalle: "Se nota más pálido, con menos rojo. Es el punto en que hay que decidir con otros datos.", mucosa: "#ec9ca0", accion: "Vigílalo: evalúalo de nuevo en una o dos semanas. Desparasita si está flaco, recién parido o en lactancia." },
  4: { color: "Rosado pálido", texto: "Anemia", tono: "alerta", detalle: "Casi blanco, con muy poco rosado y se le ven los vasos finos.", mucosa: "#f3cdc8", accion: "Conviene desparasitarlo." },
  5: { color: "Blanco", texto: "Anemia grave", tono: "alerta", detalle: "Nada de rosado. Mala irrigación de sangre.", mucosa: "#f6f1ea", accion: "Desparasítalo ya y consulta al veterinario: está en riesgo." },
};

/** Cómo revisar bien el ojo: los pasos y las notas que acompañan a la tarjeta de colores. */
export const GUIA_FAMACHA = {
  pasos: [
    "Revisa con luz natural. La sombra o una luz amarilla cambian el color.",
    "Sujeta bien al animal y baja con el pulgar el párpado de abajo, sin apretar el ojo.",
    "Mira el color de la parte interna del párpado y compáralo con la escala.",
    "Si dudas entre dos puntajes, repite la revisión con calma y con buena luz.",
  ],
  notas: [
    "Úsalo junto con otros datos: condición corporal, apetito, rendimiento y, si puedes, el coprológico (conteo de huevos en el estiércol).",
    "Es más útil para detectar la anemia que causa la lombriz del cuajar (Haemonchus contortus) y debe ser parte de un plan completo contra parásitos.",
    "Cada animal es distinto. Ante la duda, consulta al veterinario o a alguien con experiencia en ganado.",
  ],
} as const;

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
