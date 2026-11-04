import {
  ALIAS_ENCABEZADO,
  COLUMNAS,
  SEXO_HEMBRA,
  SEXO_MACHO,
  claveEncabezado,
  leerEspecie,
  leerFecha,
  normalizar,
  type ColumnaId,
} from "@/lib/importar-animales";

/**
 * Asistente de columnas del cargue: dado el archivo de la persona (sus títulos y unos valores de cada columna), propone a qué campo de Apriscol
 * corresponde cada una. Es solo una propuesta que la persona confirma o cambia en pantalla. Todo es puro (sin Excel ni base) para poder probarlo.
 */

export type ColumnaArchivo = {
  /** Posición de la columna en la hoja (0 = A). */
  indice: number;
  encabezado: string;
  /** Los valores de la columna como texto (hasta `MAX_VALORES_MAPEO`), para reconocer el contenido cuando el título no ayuda. */
  valores: string[];
};

export const MAX_VALORES_MAPEO = 500;

/** Los campos que la persona puede elegir para una columna, con el nombre que ve. «estado» solo sirve para saltar a los dados de baja. */
export const CAMPOS_MAPEO: { id: ColumnaId; titulo: string }[] = [
  ...COLUMNAS.map((c) => ({ id: c.id as ColumnaId, titulo: c.titulo })),
  { id: "estado", titulo: "Estado (omite vendidos, muertos…)" },
];

/** Los títulos que se reconocen solo si el encabezado es exactamente ese (no por parecido): un parecido no debe volver «estado» un filtro de bajas. */
const SOLO_EXACTO: ColumnaId[] = ["estado"];

const ALIAS_ESTADO = ["estado", "situacion"];

type Candidato = { id: ColumnaId; puntaje: number };

const porClave = (() => {
  const m = new Map<string, ColumnaId>();
  for (const c of COLUMNAS) {
    m.set(claveEncabezado(c.titulo), c.id);
    for (const a of ALIAS_ENCABEZADO[c.id] ?? []) m.set(claveEncabezado(a), c.id);
  }
  for (const a of ALIAS_ESTADO) m.set(claveEncabezado(a), "estado");
  return m;
})();

/** El mejor campo para un título: exacto (100) o por contener un nombre conocido (hasta ~80, más cuanto más largo el nombre). */
function candidatoPorTitulo(encabezado: string): Candidato | null {
  const clave = claveEncabezado(encabezado);
  if (!clave) return null;
  const exacto = porClave.get(clave);
  if (exacto) return { id: exacto, puntaje: 100 };
  let mejor: Candidato | null = null;
  for (const [alias, id] of porClave) {
    if (SOLO_EXACTO.includes(id) || alias.length < 4) continue;
    // el nombre conocido aparece en el título como palabra(s) completas: «fecha nac. cría» contiene «fecha nac»
    const dentro = ` ${clave} `.includes(` ${alias} `);
    if (!dentro) continue;
    const puntaje = 50 + Math.min(alias.length, 30);
    if (!mejor || puntaje > mejor.puntaje) mejor = { id, puntaje };
  }
  return mejor;
}

/** Qué tan reconocible es un título como nombre de un campo (0 si no lo es): sirve para encontrar la fila de títulos de la hoja. */
export const puntajeDeTitulo = (encabezado: string) => candidatoPorTitulo(encabezado)?.puntaje ?? 0;

const noVacios = (valores: string[]) => valores.map((v) => v.trim()).filter((v) => v !== "");
const proporcion = (valores: string[], cumple: (v: string) => boolean) => {
  const v = noVacios(valores);
  return v.length === 0 ? 0 : v.filter(cumple).length / v.length;
};

/** Cuántos de los valores se leen como una fecha (de Excel ya vienen como AAAA-MM-DD). */
const proporcionFechas = (valores: string[]) => proporcion(valores, (v) => !leerFecha(v).error && /\d/.test(v));

/**
 * Propone un campo para cada columna (o null si no se reconoce). Por título primero; si el título no ayuda, por el contenido (sexo, especie y el
 * arete, que es la columna de valores casi todos distintos y cortos). Un mismo campo no se propone para dos columnas. Un «padre» o «madre» cuyos
 * valores son aretes que ya existen (en el archivo o en el hato) se propone como arete y no como nombre.
 */
export function proponerMapeo(columnas: ColumnaArchivo[], aretesDelHato: Iterable<string> = []): (ColumnaId | null)[] {
  const resultado: (ColumnaId | null)[] = columnas.map(() => null);
  const puntajes: number[] = columnas.map(() => 0);

  // 1) Por título.
  const candidatos = columnas.map((c) => candidatoPorTitulo(c.encabezado));
  const orden = columnas.map((_, i) => i).sort((a, b) => (candidatos[b]?.puntaje ?? 0) - (candidatos[a]?.puntaje ?? 0) || a - b);
  const usados = new Set<ColumnaId>();
  for (const i of orden) {
    const c = candidatos[i];
    if (!c || usados.has(c.id)) continue;
    usados.add(c.id);
    resultado[i] = c.id;
    puntajes[i] = c.puntaje;
  }

  // 2) Por contenido, solo en columnas sin propuesta y campos libres.
  const libres = columnas.map((_, i) => i).filter((i) => resultado[i] === null);
  const asignar = (id: ColumnaId, i: number) => {
    resultado[i] = id;
    usados.add(id);
  };
  if (!usados.has("sexo")) {
    const i = libres.find((j) => resultado[j] === null && proporcion(columnas[j].valores, (v) => [...SEXO_HEMBRA, ...SEXO_MACHO].includes(normalizar(v))) >= 0.8);
    if (i !== undefined) asignar("sexo", i);
  }
  if (!usados.has("especie")) {
    const i = libres.find((j) => resultado[j] === null && proporcion(columnas[j].valores, (v) => leerEspecie(v) !== null) >= 0.8);
    if (i !== undefined) asignar("especie", i);
  }
  if (!usados.has("numero_arete")) {
    const i = libres.find((j) => {
      if (resultado[j] !== null) return false;
      const v = noVacios(columnas[j].valores);
      if (v.length < 2) return false;
      const distintos = new Set(v.map(normalizar)).size;
      const largoMedio = v.reduce((n, x) => n + x.length, 0) / v.length;
      return distintos / v.length >= 0.95 && largoMedio <= 20 && proporcionFechas(v) < 0.5;
    });
    if (i !== undefined) asignar("numero_arete", i);
  }

  // 3) «Padre», «madre» y «semental» con aretes de verdad: se cambian a la columna de arete.
  const conocidos = new Set<string>([...aretesDelHato].map(normalizar));
  const iArete = resultado.indexOf("numero_arete");
  if (iArete >= 0) for (const v of noVacios(columnas[iArete].valores)) conocidos.add(normalizar(v));
  const cambios: [ColumnaId, ColumnaId][] = [
    ["padre_externo", "padre_arete"],
    ["madre_externa", "madre_arete"],
    ["semental_externo", "semental_arete"],
  ];
  for (const [externo, arete] of cambios) {
    const i = resultado.indexOf(externo);
    if (i < 0 || usados.has(arete)) continue;
    if (proporcion(columnas[i].valores, (v) => conocidos.has(normalizar(v))) >= 0.5) {
      resultado[i] = arete;
      usados.delete(externo);
      usados.add(arete);
    }
  }
  return resultado;
}

/** Los campos que faltan para poder cargar con este mapeo (solo el arete es indispensable: lo demás se valida fila por fila). */
export function faltantesDelMapeo(mapeo: (ColumnaId | null)[]): string[] {
  return mapeo.includes("numero_arete") ? [] : ["Número de arete"];
}

/** Un mapeo válido: un campo no puede estar en dos columnas. Devuelve el título del campo repetido, si lo hay. */
export function campoRepetido(mapeo: (ColumnaId | null)[]): string | null {
  const vistos = new Set<ColumnaId>();
  for (const id of mapeo) {
    if (!id) continue;
    if (vistos.has(id)) return CAMPOS_MAPEO.find((c) => c.id === id)?.titulo ?? id;
    vistos.add(id);
  }
  return null;
}
