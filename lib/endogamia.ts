/** Lectura de la endogamia (coeficiente F de Wright) para personas: nivel, texto y confianza del pedigrí. */

export type NivelEndogamia = "bajo" | "vigilar" | "alto" | "muy_alto";

export const ETIQUETA_NIVEL: Record<NivelEndogamia, string> = {
  bajo: "Aceptable",
  vigilar: "A vigilar",
  alto: "Alta",
  muy_alto: "Muy alta",
};

export const TONO_NIVEL = { bajo: "ok", vigilar: "aviso", alto: "alerta", muy_alto: "alerta" } as const;

/** La endogamia y el umbral con cinco decimales (0,0625 → 6250): iguala los valores que son lo mismo y absorbe el ruido del decimal binario. */
const centesimas = (f: number) => Math.round(f * 100000);

/**
 * Escala a partir del umbral de la finca: aceptable (menos de la mitad del umbral), a vigilar (desde la mitad), alta (desde el umbral)
 * y muy alta (desde el doble). Se compara con la precisión que se ve en pantalla, para que quien muestra «3,13 %» nunca quede por
 * debajo de un umbral de «3,13 %» por un decimal escondido (el umbral estricto es exactamente 0,03125, igual que la endogamia que le corresponde).
 * Un animal que llega justo a un valor entra en el nivel siguiente.
 */
export function nivelEndogamia(f: number, umbral: number): NivelEndogamia {
  const x = centesimas(f);
  const u = centesimas(umbral);
  if (x <= 0 || x < u / 2) return "bajo";
  if (x < u) return "vigilar";
  if (x < u * 2) return "alto";
  return "muy_alto";
}

/** ¿Está en el umbral de la finca o por encima? (alta o muy alta) */
export function sobreElUmbral(f: number, umbral: number): boolean {
  const nivel = nivelEndogamia(f, umbral);
  return nivel === "alto" || nivel === "muy_alto";
}

export type Reparto = { sobre: number; vigilar: number; aceptables: number; sin: number };

/** Reparte los animales medidos en tres grupos que suman el total: sobre el umbral, a vigilar y aceptables (incluye a los que no tienen endogamia). */
export function repartirPorNivel(fs: number[], umbral: number): Reparto {
  const r: Reparto = { sobre: 0, vigilar: 0, aceptables: 0, sin: 0 };
  for (const f of fs) {
    const nivel = nivelEndogamia(f, umbral);
    if (nivel === "alto" || nivel === "muy_alto") r.sobre++;
    else if (nivel === "vigilar") r.vigilar++;
    else {
      r.aceptables++;
      if (centesimas(f) <= 0) r.sin++;
    }
  }
  return r;
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
      return "Cruza recomendable: la cría tendría una endogamia aceptable.";
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

export type ParentescoPadres = {
  padre: NodoLinaje;
  madre: NodoLinaje;
  /** «medios hermanos», «tío y sobrina»… dicho del padre y la madre entre sí. */
  relacion: string;
  /** Detalle del vínculo («comparten el padre», «ancestro común más cercano…»), si aporta algo. */
  via: string | null;
  /** Otros ancestros repetidos además del principal. */
  otros: number;
};

function relacionEntre(a: number, b: number, comparten: number): string {
  const lejos = (n: number) => `ancestro y descendiente (${n} generaciones)`;
  if (a === 0) return ["", "padre e hija", "abuelo y nieta", "bisabuelo y bisnieta"][b] || lejos(b);
  if (b === 0) return ["", "madre e hijo", "abuela y nieto", "bisabuela y bisnieto"][a] || lejos(a);
  if (a === 1 && b === 1) return comparten >= 2 ? "hermanos completos" : "medios hermanos";
  if (a === 1 && b === 2) return "tío y sobrina";
  if (a === 2 && b === 1) return "tía y sobrino";
  if (a === 1 && b === 3) return "tío abuelo y sobrina nieta";
  if (a === 3 && b === 1) return "tía abuela y sobrino nieto";
  if (a === 2 && b === 2) return "primos hermanos";
  if ((a === 2 && b === 3) || (a === 3 && b === 2)) return "primos hermanos en distinto grado";
  if (a === 3 && b === 3) return "primos segundos";
  return `parientes (su ancestro común más cercano está a ${a} generaciones del padre y a ${b} de la madre)`;
}

/** Parentesco entre el padre y la madre (o el macho y la hembra de una cruza), deducido de las rutas hasta su ancestro principal. */
export function describirParentesco(filas: AncestroEndogamia[]): ParentescoPadres | null {
  if (filas.length === 0) return null;
  const pasos = (f: AncestroEndogamia) => [f.ruta_padre.length - 1, f.ruta_madre.length - 1] as const;
  const ordenadas = [...filas].sort((x, y) => y.aporte - x.aporte || pasos(x)[0] + pasos(x)[1] - (pasos(y)[0] + pasos(y)[1]));
  const principal = ordenadas[0];
  const [a, b] = pasos(principal);
  const clave = (f: AncestroEndogamia) => `${f.ancestro_chip}|${f.ancestro_nombre ?? ""}`;
  const mismosPasos = new Set(filas.filter((f) => pasos(f)[0] === a && pasos(f)[1] === b).map(clave)).size;
  const ancestros = new Set(filas.map(clave)).size;
  const ancestro = etiquetaLinaje({ c: principal.ancestro_chip, n: principal.ancestro_nombre });

  let via: string | null = null;
  if (a === 1 && b === 1) {
    via = mismosPasos >= 2 ? "tienen el mismo padre y la misma madre" : `comparten ${principal.ancestro_sexo === "macho" ? "el padre" : "la madre"}, ${ancestro}`;
  } else if (a > 0 && b > 0) {
    via = `su ancestro común más cercano es ${ancestro}`;
  }
  return {
    padre: principal.ruta_padre[0],
    madre: principal.ruta_madre[0],
    relacion: relacionEntre(a, b, mismosPasos),
    via,
    otros: ancestros - mismosPasos,
  };
}

export const primeraMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
