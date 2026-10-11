/** Lectura de la endogamia (coeficiente F de Wright) para personas: nivel, texto y confianza del pedigrí. */

export type NivelEndogamia = "bajo" | "vigilar" | "alto" | "muy_alto";

export const ETIQUETA_NIVEL: Record<NivelEndogamia, string> = {
  bajo: "Baja",
  vigilar: "A vigilar",
  alto: "Alta",
  muy_alto: "Muy alta",
};

export const TONO_NIVEL = { bajo: "ok", vigilar: "aviso", alto: "alerta", muy_alto: "alerta" } as const;

/** Escala a partir del umbral de la finca: mitad = a vigilar, umbral = alta, el doble = muy alta. */
export function nivelEndogamia(f: number, umbral: number): NivelEndogamia {
  if (f <= 0 || f < umbral / 2) return "bajo";
  if (f < umbral) return "vigilar";
  if (f < umbral * 2) return "alto";
  return "muy_alto";
}

/** 0,0625 → «6,25 %» */
export function porcentaje(f: number): string {
  return `${(f * 100).toFixed(2).replace(".", ",")} %`;
}

export function pedigriTexto(completitud: number): string {
  if (completitud >= 0.75) return "Pedigrí completo";
  if (completitud >= 0.4) return "Pedigrí parcial";
  if (completitud > 0) return "Pedigrí corto";
  return "Sin pedigrí";
}

/** Frase para quien decide una cruza. */
export function recomendacionCruza(nivel: NivelEndogamia): string {
  switch (nivel) {
    case "bajo":
      return "Cruza recomendable: la cría tendría una endogamia baja.";
    case "vigilar":
      return "Aceptable, pero ya se acerca al umbral de tu finca. Conviene vigilarla.";
    case "alto":
      return "No es recomendable: la cría superaría el umbral de tu finca.";
    case "muy_alto":
      return "Mejor evitarla: la endogamia de la cría sería muy alta.";
  }
}

export type NodoLinaje = { c: string | null; n: string | null; s: "macho" | "hembra" };
export type AncestroEndogamia = {
  ancestro_chip: string;
  ancestro_nombre: string | null;
  ancestro_sexo: "macho" | "hembra";
  aporte: number;
  ruta_padre: NodoLinaje[];
  ruta_madre: NodoLinaje[];
};

/** Rótulo del puesto de un antepasado visto desde la cría: 1 = padre o madre, 2 = abuelo o abuela… */
export function puestoLinaje(posicion: number, sexo: "macho" | "hembra"): string {
  const m = sexo === "macho";
  if (posicion === 1) return m ? "Padre" : "Madre";
  if (posicion === 2) return m ? "Abuelo" : "Abuela";
  if (posicion === 3) return m ? "Bisabuelo" : "Bisabuela";
  if (posicion === 4) return m ? "Tatarabuelo" : "Tatarabuela";
  return `Antepasado, generación ${posicion}`;
}

/** Identificador original (microchip o arete) y nombre: «605*564*832 · CAROLINA». */
export function etiquetaLinaje(n: Pick<NodoLinaje, "c" | "n">): string {
  return [n.c, n.n].filter(Boolean).join(" · ") || "Sin identificar";
}
