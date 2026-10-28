import type { Especie, SexoAnimal } from "@/lib/tipos";

export function etiquetaAnimal(a: { numero_arete: string; nombre: string | null }): string {
  return a.nombre ? `${a.nombre} · ${a.numero_arete}` : a.numero_arete;
}

export function nombreTipo(especie: Especie, sexo: SexoAnimal): string {
  if (especie === "caprino") return sexo === "hembra" ? "Cabra" : "Cabro";
  return sexo === "hembra" ? "Oveja" : "Carnero";
}

const PLURAL_TIPO = { caprino: { hembra: "Cabras", macho: "Cabros" }, ovino: { hembra: "Ovejas", macho: "Carneros" } } as const;
const ORDEN_TIPOS = ["Cabras", "Cabros", "Ovejas", "Carneros"];

/**
 * Agrupa animales por tipo (cabras, cabros, ovejas, carneros) para las listas donde se mezclan, en ese orden. Los que no traen especie y sexo
 * quedan en un solo grupo sin título, tal como llegaron.
 */
export function agruparPorTipo<T extends { especie?: Especie; sexo?: SexoAnimal }>(items: T[]): { titulo: string | null; items: T[] }[] {
  const grupos = new Map<string | null, T[]>();
  for (const a of items) {
    const titulo = a.especie && a.sexo ? PLURAL_TIPO[a.especie][a.sexo] : null;
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), a]);
  }
  const conTitulo = ORDEN_TIPOS.filter((t) => grupos.has(t)).map((t) => ({ titulo: t, items: grupos.get(t)! }));
  return grupos.has(null) ? [...(conTitulo.length ? conTitulo : []), { titulo: null, items: grupos.get(null)! }] : conTitulo;
}

export const ETIQUETA_USO_MACHO = { reproductor: "Reproductor", carne: "Carne (engorde)" } as const;

export const ETIQUETA_VOCACION = { leche: "Leche", carne: "Carne", doble: "Doble propósito" } as const;
export const ETIQUETA_JORNADA = { manana: "Mañana", tarde: "Tarde", noche: "Noche", unico: "Único" } as const;

export function saludo(fecha = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(fecha));
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
