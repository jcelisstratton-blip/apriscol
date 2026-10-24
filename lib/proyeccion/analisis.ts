import { porAnio, simular, type Estacion, type Inicio, type Proyeccion } from "@/lib/proyeccion/motor";
import { DEFINICION, type ClaveSupuesto, type Supuestos } from "@/lib/proyeccion/supuestos";

/** Todo lo que el simulador necesita además de los supuestos: así un análisis puede correr el mismo hato muchas veces con números distintos. */
export type Entrada = { inicio: Inicio; horizonte: number; gestacionDias: number; estacion?: Estacion };

export const correr = (e: Entrada, s: Supuestos): Proyeccion => simular(e.inicio, s, e.horizonte, e.gestacionDias, e.estacion);

export type Totales = {
  meses: number;
  ingresos: number;
  ingresosCarne: number;
  ingresosLeche: number;
  costos: number;
  flujo: number;
  litros: number;
  kgVendidos: number;
  ventasAnimales: number;
  nacimientos: number;
  vientresFinal: number;
  totalFinal: number;
  picoAnimales: number;
};

/** Las cifras de los primeros `n` meses (todo el horizonte si no se dice). */
export function totales(p: Proyeccion, n = p.meses.length): Totales {
  const m = p.meses.slice(0, n);
  const s = (f: (x: (typeof m)[number]) => number) => m.reduce((a, x) => a + f(x), 0);
  const ultimo = m[m.length - 1];
  return {
    meses: m.length,
    ingresos: s((x) => x.ingresos),
    ingresosCarne: s((x) => x.ingresosCarne),
    ingresosLeche: s((x) => x.ingresosLeche),
    costos: s((x) => x.costos),
    flujo: s((x) => x.flujo),
    litros: s((x) => x.litros),
    kgVendidos: s((x) => x.kgVendidos),
    ventasAnimales: s((x) => x.ventasAnimales),
    nacimientos: s((x) => x.nacimientos),
    vientresFinal: ultimo?.vientres ?? p.inicio.vientres,
    totalFinal: ultimo?.total ?? p.inicio.total,
    picoAnimales: Math.max(p.inicio.total, ...m.map((x) => x.total)),
  };
}

const acotar = (clave: ClaveSupuesto, v: number) => Math.min(DEFINICION[clave].max, Math.max(DEFINICION[clave].min, v));

/** Cambiar un supuesto en una proporción, sin salirse de su rango. */
const escalar = (s: Supuestos, clave: ClaveSupuesto, factor: number): Supuestos => ({ ...s, [clave]: acotar(clave, s[clave] * factor) });

// ─────────────────────────── Sensibilidad ───────────────────────────

/** Los números que más suelen mover el resultado y que tiene sentido mover un 10 %. */
export const SENSIBLES: ClaveSupuesto[] = [
  "precio_kg_vivo",
  "peso_venta_kg",
  "precio_litro",
  "litros_dia",
  "costo_kg_ms",
  "costos_fijos_mes",
  "costo_animal_mes",
  "partos_por_hembra_anio",
  "prolificidad",
  "mortalidad_lactancia_pct",
  "mortalidad_levante_pct",
  "descarte_vientres_pct",
];

export type FilaSensibilidad = {
  clave: ClaveSupuesto;
  /** Cuánto cambia lo que queda en el horizonte (en pesos) si el número baja un 10 %. */
  siBaja: number;
  /** …y si sube un 10 %. */
  siSube: number;
  /** El mayor de los dos cambios, sin signo: para ordenar. */
  impacto: number;
};

/** Mueve cada número un `delta` hacia arriba y hacia abajo (uno por vez) y mide cuánto cambia lo que queda en total. Ordenado de mayor a menor impacto. */
export function sensibilidad(e: Entrada, s: Supuestos, delta = 0.1): FilaSensibilidad[] {
  const base = totales(correr(e, s)).flujo;
  return SENSIBLES.map((clave) => {
    const siBaja = totales(correr(e, escalar(s, clave, 1 - delta))).flujo - base;
    const siSube = totales(correr(e, escalar(s, clave, 1 + delta))).flujo - base;
    return { clave, siBaja, siSube, impacto: Math.max(Math.abs(siBaja), Math.abs(siSube)) };
  })
    .filter((f) => f.impacto > 1e-6)
    .sort((a, b) => b.impacto - a.impacto);
}

// ─────────────────────────── Punto de equilibrio ───────────────────────────

export type Equilibrio = {
  clave: "precio_kg_vivo" | "precio_litro";
  actual: number;
  /** El precio con el que lo que entra en esos meses iguala a lo que sale; nulo si esa línea no vende nada. */
  equilibrio: number | null;
  /** Cuánto puede bajar el precio actual antes de perder dinero (en %); negativo si ya hoy se pierde. */
  holguraPct: number | null;
};

/**
 * El precio mínimo para no perder dinero en los primeros `meses`. Los ingresos son una línea recta del precio, así que se calcula con dos corridas
 * (el precio actual y el doble) y no hay que tantear.
 */
export function equilibrio(e: Entrada, s: Supuestos, clave: Equilibrio["clave"], meses = e.horizonte): Equilibrio {
  const actual = s[clave];
  const f0 = totales(correr(e, s), meses).flujo;
  const f1 = totales(correr(e, { ...s, [clave]: actual * 2 }), meses).flujo;
  const pendiente = (f1 - f0) / actual;
  if (!(pendiente > 1e-9)) return { clave, actual, equilibrio: null, holguraPct: null };
  const eq = Math.max(0, actual - f0 / pendiente);
  return { clave, actual, equilibrio: eq, holguraPct: actual > 0 ? ((actual - eq) / actual) * 100 : null };
}

// ─────────────────────────── Pesimista / base / optimista ───────────────────────────

export type NombreRango = "pesimista" | "base" | "optimista";

/** Qué se mueve en cada camino. Los factores multiplican el valor actual del supuesto. */
export const CHOQUES: Record<NombreRango, Partial<Record<ClaveSupuesto, number>>> = {
  pesimista: { precio_kg_vivo: 0.85, precio_litro: 0.85, costo_kg_ms: 1.2, mortalidad_lactancia_pct: 1.5, mortalidad_levante_pct: 1.5, prolificidad: 0.9, litros_dia: 0.9 },
  base: {},
  optimista: { precio_kg_vivo: 1.1, precio_litro: 1.1, costo_kg_ms: 0.95, mortalidad_lactancia_pct: 0.7, mortalidad_levante_pct: 0.7, prolificidad: 1.05, litros_dia: 1.05 },
};

export const DESCRIPCION_RANGO: Record<NombreRango, string> = {
  pesimista: "Precios 15 % más bajos, alimento 20 % más caro, 50 % más muertes de crías, 10 % menos crías por parto y 10 % menos leche.",
  base: "Los números que tienes en pantalla.",
  optimista: "Precios 10 % más altos, alimento 5 % más barato, 30 % menos muertes de crías, 5 % más crías por parto y 5 % más leche.",
};

export type FilaRango = { nombre: NombreRango; totales: Totales; flujoPorAnio: number[] };

export function rango(e: Entrada, s: Supuestos): FilaRango[] {
  return (["pesimista", "base", "optimista"] as NombreRango[]).map((nombre) => {
    let sup = s;
    for (const [clave, factor] of Object.entries(CHOQUES[nombre]) as [ClaveSupuesto, number][]) sup = escalar(sup, clave, factor);
    const p = correr(e, sup);
    return { nombre, totales: totales(p), flujoPorAnio: porAnio(p).map((b) => b.flujo) };
  });
}
