import type { NivelFeria, ResultadoFeria } from "@/lib/tipos";

export const ETIQUETA_NIVEL: Record<NivelFeria, string> = {
  local: "Local",
  regional: "Regional",
  nacional: "Nacional",
  internacional: "Internacional",
};

export const ETIQUETA_RESULTADO: Record<ResultadoFeria, string> = {
  gran_campeon: "Gran campeón",
  campeon: "Campeón",
  subcampeon: "Subcampeón",
  reservado_campeon: "Reservado campeón",
  mejor_ejemplar: "Mejor ejemplar",
  mencion_honor: "Mención de honor",
  participacion: "Participó",
  otro: "Otro reconocimiento",
};

export const TONO_RESULTADO: Record<ResultadoFeria, "ok" | "musgo" | "aviso" | "neutro"> = {
  gran_campeon: "ok",
  campeon: "ok",
  subcampeon: "musgo",
  reservado_campeon: "musgo",
  mejor_ejemplar: "musgo",
  mencion_honor: "aviso",
  participacion: "neutro",
  otro: "neutro",
};

export const RESULTADOS: ResultadoFeria[] = [
  "gran_campeon", "campeon", "subcampeon", "reservado_campeon", "mejor_ejemplar", "mencion_honor", "participacion", "otro",
];

export const TIPOS_FOTO: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function pesos(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n ?? 0);
}
