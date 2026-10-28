/**
 * Examen coprológico (conteo de huevos en heces) en cabras y ovejas. Los números son una referencia de la literatura veterinaria, no una ley: no hay un
 * umbral universal, y el veterinario del aprisco manda (ver `docs/modulos/sanidad-corrales.md`). Todo lo que se muestra sale de aquí: el nivel no se guarda.
 */

export type TecnicaCoprologico = "mcmaster" | "mini_flotac" | "flotacion" | "otra";
export const TECNICAS_COPROLOGICO: TecnicaCoprologico[] = ["mcmaster", "mini_flotac", "flotacion", "otra"];
export const ETIQUETA_TECNICA: Record<TecnicaCoprologico, string> = {
  mcmaster: "McMaster",
  mini_flotac: "Mini-FLOTAC",
  flotacion: "Flotación (solo presencia)",
  otra: "Otra",
};
export const AYUDA_TECNICA: Record<TecnicaCoprologico, string> = {
  mcmaster: "La más usada: cuenta los huevos por gramo de heces (HPG).",
  mini_flotac: "Más sensible que McMaster; también da huevos por gramo.",
  flotacion: "Dice si hay huevos, pero no cuántos. Para un número usa McMaster o Mini-FLOTAC.",
  otra: "Otra técnica del laboratorio.",
};

export type MomentoCoprologico = "diagnostico" | "antes" | "despues";
export const ETIQUETA_MOMENTO: Record<MomentoCoprologico, string> = {
  diagnostico: "Diagnóstico",
  antes: "Antes de desparasitar",
  despues: "Después de desparasitar",
};

export type OtroParasito = "moniezia" | "strongyloides" | "trichuris" | "nematodirus" | "fasciola" | "dicrocelium";
export const OTROS_PARASITOS: OtroParasito[] = ["moniezia", "strongyloides", "trichuris", "nematodirus", "fasciola", "dicrocelium"];
export const ETIQUETA_OTRO_PARASITO: Record<OtroParasito, string> = {
  moniezia: "Moniezia (tenia)",
  strongyloides: "Strongyloides",
  trichuris: "Trichuris",
  nematodirus: "Nematodirus",
  fasciola: "Fasciola (babosa del hígado)",
  dicrocelium: "Dicrocelium",
};

/** Cortes de huevos por gramo (HPG). Con Haemonchus los conteos altos van con anemia: se cruza con FAMACHA. */
export const HPG_BAJO = 250;
export const HPG_ALTO = 1000;
export const HPG_MUY_ALTO = 3000;

export type NivelHpg = "bajo" | "moderado" | "alto" | "muy_alto";
export type InterpretacionHpg = { nivel: NivelHpg; texto: string; tono: "ok" | "neutro" | "aviso" | "alerta"; accion: string };

export function interpretarHpg(hpg: number): InterpretacionHpg {
  if (hpg < HPG_BAJO) return { nivel: "bajo", texto: "Carga baja", tono: "ok", accion: "No hace falta desparasitar por este resultado. Repite el examen según el manejo de la finca." };
  if (hpg < HPG_ALTO) return { nivel: "moderado", texto: "Carga moderada", tono: "neutro", accion: "Vigílalo: cruza con FAMACHA y la condición corporal. Desparasita solo si hay anemia o está flaco." };
  if (hpg < HPG_MUY_ALTO) return { nivel: "alto", texto: "Carga alta", tono: "aviso", accion: "Conviene desparasitar. Después, repite el examen a los 10 a 14 días para comprobar que el producto funcionó." };
  return { nivel: "muy_alto", texto: "Carga muy alta", tono: "alerta", accion: "Desparasita pronto y revísale la mucosa del ojo (FAMACHA): con estas cargas suele haber anemia. Repite el examen a los 10 a 14 días." };
}

/** Los ooquistes (coccidios) no tienen un corte fiable con McMaster: el conteo repite poco y depende de la edad y de si hay diarrea. */
export const AYUDA_OOQUISTES = "Los ooquistes se leen junto con la edad y la diarrea: en cabritos y corderos de pocas semanas pesan más. Su conteo es poco repetible: no decide solo el tratamiento.";

/** Un examen contado (con HPG): lo que hace falta para la prueba de eficacia. */
export type ExamenEficacia = { animal_id: string; momento: MomentoCoprologico; hpg: number | null };

export type ResultadoEficacia = {
  /** Animales con examen antes y después. */
  n: number;
  mediaAntes: number;
  mediaDespues: number;
  /** Reducción del promedio de huevos, en porcentaje (puede ser negativa si subió). */
  reduccion: number;
  veredicto: "eficaz" | "dudoso" | "resistencia";
  texto: string;
  /** Con menos de 10 animales el resultado es solo una orientación. */
  orientativo: boolean;
};

/** Mínimo de animales para que la prueba sea confiable. */
export const ANIMALES_MIN_EFICACIA = 10;

/**
 * Prueba de reducción del conteo de huevos (FECRT): compara el promedio de HPG de los animales que tienen examen antes y después de desparasitar.
 * Reducción de 95 % o más = eficaz; entre 90 y 95 % = dudoso; menos de 90 % = sospecha de resistencia. Devuelve null si ningún animal tiene los dos.
 */
export function eficaciaDesparasitante(examenes: ExamenEficacia[]): ResultadoEficacia | null {
  const antes = new Map<string, number>();
  const despues = new Map<string, number>();
  for (const e of examenes) {
    if (e.hpg === null) continue;
    if (e.momento === "antes") antes.set(e.animal_id, e.hpg);
    else if (e.momento === "despues") despues.set(e.animal_id, e.hpg);
  }
  const ids = [...antes.keys()].filter((id) => despues.has(id));
  if (ids.length === 0) return null;
  const mediaAntes = ids.reduce((s, id) => s + antes.get(id)!, 0) / ids.length;
  const mediaDespues = ids.reduce((s, id) => s + despues.get(id)!, 0) / ids.length;
  if (mediaAntes <= 0) return null;
  const reduccion = Math.round((1 - mediaDespues / mediaAntes) * 1000) / 10;
  const veredicto = reduccion >= 95 ? "eficaz" : reduccion >= 90 ? "dudoso" : "resistencia";
  const texto =
    veredicto === "eficaz"
      ? "El desparasitante funcionó: bajó los huevos en 95 % o más."
      : veredicto === "dudoso"
        ? "Resultado dudoso (entre 90 y 95 %). Repite la prueba antes de cambiar de producto."
        : "Bajó menos de 90 %: puede haber resistencia a este desparasitante. Habla con tu veterinario antes de volver a usarlo.";
  return { n: ids.length, mediaAntes: Math.round(mediaAntes), mediaDespues: Math.round(mediaDespues), reduccion, veredicto, texto, orientativo: ids.length < ANIMALES_MIN_EFICACIA };
}

/** Texto corto de un resultado: «1.200 HPG · 3.000 OPG». */
export function textoResultado(x: { hpg: number | null; opg: number | null }): string {
  const n = (v: number) => v.toLocaleString("es-CO");
  return [x.hpg !== null ? `${n(x.hpg)} HPG` : null, x.opg !== null ? `${n(x.opg)} OPG` : null].filter(Boolean).join(" · ");
}
