import type { Totales } from "@/lib/proyeccion/analisis";
import type { Formato } from "@/lib/proyeccion/vista";

export type FilaComparacion = { titulo: string; formato: Formato; valor: (t: Totales) => number; /** Si es mejor que sea más alto (lo que queda) o más bajo (los costos). */ mejor: "alto" | "bajo" | null; destacada?: boolean };

export const FILAS_COMPARACION: FilaComparacion[] = [
  { titulo: "Ingresos por carne", formato: "pesos", valor: (t) => t.ingresosCarne, mejor: "alto" },
  { titulo: "Ingresos por leche", formato: "pesos", valor: (t) => t.ingresosLeche, mejor: "alto" },
  { titulo: "Costos", formato: "pesos", valor: (t) => t.costos, mejor: "bajo" },
  { titulo: "Lo que queda en total", formato: "pesos", valor: (t) => t.flujo, mejor: "alto", destacada: true },
  { titulo: "Animales vendidos", formato: "n0", valor: (t) => t.ventasAnimales, mejor: null },
  { titulo: "Kilos vendidos", formato: "n0", valor: (t) => t.kgVendidos, mejor: null },
  { titulo: "Litros de leche", formato: "n0", valor: (t) => t.litros, mejor: null },
  { titulo: "Reproductoras al final", formato: "n0", valor: (t) => t.vientresFinal, mejor: null },
  { titulo: "Animales al final", formato: "n0", valor: (t) => t.totalFinal, mejor: null },
  { titulo: "Más animales en un mes", formato: "n0", valor: (t) => t.picoAnimales, mejor: null },
];

/** Los mejores de cada fila (los que empatan se marcan todos); sin marca si todos son iguales. */
export function ganadores(fila: FilaComparacion, valores: number[]): boolean[] {
  if (!fila.mejor || valores.length < 2) return valores.map(() => false);
  const mejor = fila.mejor === "alto" ? Math.max(...valores) : Math.min(...valores);
  if (valores.every((v) => Math.abs(v - mejor) < 0.5)) return valores.map(() => false);
  return valores.map((v) => Math.abs(v - mejor) < 0.5);
}
