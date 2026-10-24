/**
 * Los supuestos de una proyección: cada uno con su valor de referencia, su rango y de dónde sale el número que se muestra.
 * Lo que se guarda por escenario son solo los AJUSTES de la persona; el resto se recalcula con los datos al día de la finca
 * (`cargar.ts`) o, si la finca todavía no tiene datos suficientes, toma el valor de referencia.
 */

export type GrupoSupuesto = "hato" | "carne" | "leche" | "alimento" | "dinero";

export const ETIQUETA_GRUPO_SUPUESTO: Record<GrupoSupuesto, string> = {
  hato: "El hato",
  carne: "Carne",
  leche: "Leche",
  alimento: "Alimento",
  dinero: "Costos",
};

export type ClaveSupuesto =
  | "partos_por_hembra_anio" | "prolificidad" | "proporcion_hembras_pct" | "prenez_servidas_pct"
  | "mortalidad_lactancia_pct" | "mortalidad_levante_pct" | "mortalidad_adultos_pct" | "descarte_vientres_pct"
  | "retencion_hembras_pct" | "crecimiento_hato_pct" | "destete_meses" | "edad_venta_meses" | "edad_entrada_vientres_meses"
  | "lactancia_meses"
  | "peso_venta_kg" | "precio_kg_vivo" | "peso_descarte_kg" | "castigo_descarte_pct"
  | "litros_dia" | "hembras_ordenadas_pct" | "precio_litro"
  | "ms_vientre_seco" | "ms_vientre_lactando" | "ms_semental" | "ms_cria" | "ms_levante" | "costo_kg_ms"
  | "costo_animal_mes" | "costos_fijos_mes" | "capacidad_max_animales";

export type Supuestos = Record<ClaveSupuesto, number>;
export type Ajustes = Partial<Record<ClaveSupuesto, number>>;

/** De dónde sale el valor que se ve: de los datos de la finca, de un valor de referencia, o lo cambió la persona. */
export type OrigenSupuesto = "finca" | "referencia" | "ajuste";
export const ETIQUETA_ORIGEN: Record<OrigenSupuesto, string> = { finca: "De tu finca", referencia: "Referencia", ajuste: "Tu ajuste" };

export type Unidad = "n" | "pct" | "meses" | "kg" | "pesos" | "litros" | "kg_ms";

export type DefinicionSupuesto = {
  clave: ClaveSupuesto;
  grupo: GrupoSupuesto;
  etiqueta: string;
  /** Una línea que explica qué es, en palabras del campo. */
  detalle: string;
  unidad: Unidad;
  min: number;
  max: number;
  decimales: number;
  referencia: number;
};

export const DEFINICIONES: DefinicionSupuesto[] = [
  // El hato
  { clave: "partos_por_hembra_anio", grupo: "hato", etiqueta: "Partos por hembra al año", detalle: "Cuántas veces pare en promedio cada hembra reproductora en un año.", unidad: "n", min: 0.5, max: 2.5, decimales: 2, referencia: 1.5 },
  { clave: "prolificidad", grupo: "hato", etiqueta: "Crías vivas por parto", detalle: "Promedio de crías nacidas vivas en cada parto (1 = sencillos, 2 = mellizos).", unidad: "n", min: 1, max: 3, decimales: 2, referencia: 1.4 },
  { clave: "proporcion_hembras_pct", grupo: "hato", etiqueta: "Hembras entre las crías", detalle: "De cada 100 crías nacidas, cuántas son hembras.", unidad: "pct", min: 30, max: 70, decimales: 0, referencia: 50 },
  { clave: "prenez_servidas_pct", grupo: "hato", etiqueta: "Servidas que resultan preñadas", detalle: "De las hembras servidas que aún no tienen diagnóstico, cuántas de cada 100 paren.", unidad: "pct", min: 0, max: 100, decimales: 0, referencia: 60 },
  { clave: "mortalidad_lactancia_pct", grupo: "hato", etiqueta: "Mortalidad en lactancia", detalle: "De cada 100 crías, cuántas mueren antes del destete.", unidad: "pct", min: 0, max: 40, decimales: 1, referencia: 5 },
  { clave: "mortalidad_levante_pct", grupo: "hato", etiqueta: "Mortalidad en levante y ceba", detalle: "De cada 100 animales destetados, cuántos mueren antes de venderse.", unidad: "pct", min: 0, max: 30, decimales: 1, referencia: 3 },
  { clave: "mortalidad_adultos_pct", grupo: "hato", etiqueta: "Mortalidad de reproductoras al año", detalle: "De cada 100 hembras reproductoras, cuántas mueren en un año.", unidad: "pct", min: 0, max: 30, decimales: 1, referencia: 2 },
  { clave: "descarte_vientres_pct", grupo: "hato", etiqueta: "Descarte de reproductoras al año", detalle: "De cada 100 hembras reproductoras, cuántas se sacan del hato por edad, mala producción o problemas.", unidad: "pct", min: 0, max: 50, decimales: 1, referencia: 12 },
  { clave: "retencion_hembras_pct", grupo: "hato", etiqueta: "Hembras que se dejan de reemplazo", detalle: "De cada 100 hembras nacidas, cuántas se crían para entrar al hato reproductor.", unidad: "pct", min: 0, max: 100, decimales: 0, referencia: 20 },
  { clave: "crecimiento_hato_pct", grupo: "hato", etiqueta: "Crecimiento del hato reproductor al año", detalle: "0 mantiene el número de reproductoras; un valor positivo lo hace crecer, uno negativo lo reduce.", unidad: "pct", min: -50, max: 200, decimales: 0, referencia: 0 },
  { clave: "destete_meses", grupo: "hato", etiqueta: "Edad al destete", detalle: "Hasta qué edad la cría es lactante.", unidad: "meses", min: 1, max: 6, decimales: 0, referencia: 3 },
  { clave: "edad_entrada_vientres_meses", grupo: "hato", etiqueta: "Edad a la que una hembra entra al hato reproductor", detalle: "Cuando cumple esta edad deja de ser reemplazo y cuenta como reproductora.", unidad: "meses", min: 8, max: 24, decimales: 0, referencia: 12 },
  // Carne
  { clave: "edad_venta_meses", grupo: "carne", etiqueta: "Edad de venta", detalle: "A qué edad se venden los machos y las hembras que no se dejan de reemplazo.", unidad: "meses", min: 3, max: 24, decimales: 0, referencia: 6 },
  { clave: "peso_venta_kg", grupo: "carne", etiqueta: "Peso de venta", detalle: "Peso vivo promedio al venderse.", unidad: "kg", min: 10, max: 80, decimales: 1, referencia: 35 },
  { clave: "precio_kg_vivo", grupo: "carne", etiqueta: "Precio por kilo vivo", detalle: "Lo que te pagan por cada kilo de animal en pie.", unidad: "pesos", min: 1000, max: 100000, decimales: 0, referencia: 10000 },
  { clave: "peso_descarte_kg", grupo: "carne", etiqueta: "Peso de una reproductora de descarte", detalle: "Peso vivo promedio de una hembra adulta al sacarla del hato.", unidad: "kg", min: 15, max: 100, decimales: 1, referencia: 40 },
  { clave: "castigo_descarte_pct", grupo: "carne", etiqueta: "Descuento por vender una reproductora de descarte", detalle: "Cuánto menos se paga por el kilo de un animal adulto de descarte frente al de ceba.", unidad: "pct", min: 0, max: 80, decimales: 0, referencia: 20 },
  // Leche
  { clave: "lactancia_meses", grupo: "leche", etiqueta: "Duración de la lactancia", detalle: "Cuántos meses da leche una hembra después del parto.", unidad: "meses", min: 3, max: 12, decimales: 0, referencia: 6 },
  { clave: "hembras_ordenadas_pct", grupo: "leche", etiqueta: "Hembras en lactancia que se ordeñan", detalle: "De cada 100 hembras recién paridas, cuántas se ordeñan (las demás crían a su cría).", unidad: "pct", min: 0, max: 100, decimales: 0, referencia: 50 },
  { clave: "litros_dia", grupo: "leche", etiqueta: "Litros por hembra ordeñada al día", detalle: "Promedio de la leche que se saca por cada hembra en ordeño.", unidad: "litros", min: 0.1, max: 6, decimales: 2, referencia: 1.2 },
  { clave: "precio_litro", grupo: "leche", etiqueta: "Precio por litro", detalle: "Lo que te pagan por cada litro de leche.", unidad: "pesos", min: 200, max: 30000, decimales: 0, referencia: 3000 },
  // Alimento
  { clave: "ms_vientre_seco", grupo: "alimento", etiqueta: "Alimento de una reproductora seca", detalle: "Kilos de materia seca (el alimento sin agua) por día.", unidad: "kg_ms", min: 0.3, max: 4, decimales: 2, referencia: 1.3 },
  { clave: "ms_vientre_lactando", grupo: "alimento", etiqueta: "Alimento de una reproductora en lactancia", detalle: "Kilos de materia seca por día mientras da leche.", unidad: "kg_ms", min: 0.3, max: 5, decimales: 2, referencia: 1.8 },
  { clave: "ms_semental", grupo: "alimento", etiqueta: "Alimento de un semental", detalle: "Kilos de materia seca por día.", unidad: "kg_ms", min: 0.3, max: 5, decimales: 2, referencia: 1.5 },
  { clave: "ms_cria", grupo: "alimento", etiqueta: "Alimento de una cría lactante", detalle: "Kilos de materia seca por día, sin contar la leche de la madre.", unidad: "kg_ms", min: 0.05, max: 1.5, decimales: 2, referencia: 0.25 },
  { clave: "ms_levante", grupo: "alimento", etiqueta: "Alimento de un animal en levante o ceba", detalle: "Kilos de materia seca por día.", unidad: "kg_ms", min: 0.2, max: 3, decimales: 2, referencia: 0.8 },
  { clave: "costo_kg_ms", grupo: "alimento", etiqueta: "Costo por kilo de alimento (materia seca)", detalle: "Lo que cuesta, en promedio, cada kilo de alimento seco entre pasto, forraje, concentrado y sales.", unidad: "pesos", min: 100, max: 10000, decimales: 0, referencia: 1200 },
  // Costos
  { clave: "costo_animal_mes", grupo: "dinero", etiqueta: "Sanidad y reproducción por animal al mes", detalle: "Vacunas, tratamientos, pruebas, pajillas, aretes y fletes, repartidos entre los animales.", unidad: "pesos", min: 0, max: 100000, decimales: 0, referencia: 2500 },
  { clave: "costos_fijos_mes", grupo: "dinero", etiqueta: "Costos fijos al mes", detalle: "Mano de obra, arriendo, servicios y mantenimiento: no cambian aunque el hato crezca.", unidad: "pesos", min: 0, max: 500000000, decimales: 0, referencia: 1750000 },
  { clave: "capacidad_max_animales", grupo: "dinero", etiqueta: "Capacidad de las instalaciones", detalle: "Máximo de animales que caben en tus corrales. Con 0 no se avisa.", unidad: "n", min: 0, max: 100000, decimales: 0, referencia: 0 },
];

export const DEFINICION: Record<ClaveSupuesto, DefinicionSupuesto> = Object.fromEntries(DEFINICIONES.map((d) => [d.clave, d])) as Record<ClaveSupuesto, DefinicionSupuesto>;
export const CLAVES = DEFINICIONES.map((d) => d.clave);
export const GRUPOS_SUPUESTO: GrupoSupuesto[] = ["hato", "carne", "leche", "alimento", "dinero"];

export const REFERENCIAS: Supuestos = Object.fromEntries(DEFINICIONES.map((d) => [d.clave, d.referencia])) as Supuestos;

const esClave = (k: string): k is ClaveSupuesto => k in DEFINICION;

/** Deja pasar solo claves conocidas con números dentro de su rango (lo que viene del navegador o de la base nunca se da por bueno). */
export function limpiarAjustes(crudo: unknown): Ajustes {
  const salida: Ajustes = {};
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return salida;
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (!esClave(k) || typeof v !== "number" || !Number.isFinite(v)) continue;
    const d = DEFINICION[k];
    if (v < d.min || v > d.max) continue;
    salida[k] = v;
  }
  return salida;
}

/** ¿Está el número dentro del rango del supuesto? (para avisar en el formulario antes de aceptarlo) */
export const enRango = (clave: ClaveSupuesto, valor: number) => Number.isFinite(valor) && valor >= DEFINICION[clave].min && valor <= DEFINICION[clave].max;

/** Los valores con que se corre la simulación: el de la finca (o la referencia) y encima los ajustes de la persona. */
export function aplicarAjustes(base: Supuestos, ajustes: Ajustes): Supuestos {
  return { ...base, ...ajustes };
}

export const HORIZONTES = [12, 24, 36] as const;
export const HORIZONTE_DEFECTO = 24;
