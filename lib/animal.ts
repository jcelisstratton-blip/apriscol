import type { Especie, SexoAnimal } from "@/lib/tipos";

export function etiquetaAnimal(a: { numero_arete: string; nombre: string | null }): string {
  return a.nombre ? `${a.nombre} · ${a.numero_arete}` : a.numero_arete;
}

export function nombreTipo(especie: Especie, sexo: SexoAnimal): string {
  if (especie === "caprino") return sexo === "hembra" ? "Cabra" : "Cabro";
  return sexo === "hembra" ? "Oveja" : "Carnero";
}

export const ETIQUETA_VOCACION = { leche: "Leche", carne: "Carne", doble: "Doble propósito" } as const;
export const ETIQUETA_JORNADA = { manana: "Mañana", tarde: "Tarde", noche: "Noche", unico: "Único" } as const;

export function saludo(fecha = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(fecha));
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}
