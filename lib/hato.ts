import type { Especie } from "@/lib/tipos";

export type FiltroHato = "todos" | "hembras" | "machos" | "caprino" | "ovino" | "bajas";

/** Los filtros de la lista de animales, en el orden en que se ven (Cabras y Ovejas solo si la finca tiene las dos especies). */
export function filtrosHato(especies: Especie[]): { id: FiltroHato; texto: string }[] {
  return [
    { id: "todos", texto: "Todos" },
    { id: "hembras", texto: "Hembras" },
    { id: "machos", texto: "Machos" },
    ...(especies.length > 1 ? ([{ id: "caprino", texto: "Cabras" }, { id: "ovino", texto: "Ovejas" }] as const) : []),
    { id: "bajas", texto: "Dados de baja" },
  ];
}

export const esFiltroHato = (v: string | undefined): v is FiltroHato => ["todos", "hembras", "machos", "caprino", "ovino", "bajas"].includes(v ?? "");

/** Dirección de la lista de animales con un filtro puesto. */
export const direccionHato = (f: FiltroHato) => (f === "todos" ? "/hato" : `/hato?filtro=${f}`);
export const DIRECCION_ORDENO = "/hato?vista=ordeno";
export const DIRECCION_CEBA = "/hato?vista=ceba";
export const DIRECCION_EMPADRONAMIENTO = "/hato?vista=empadronamiento";
export const DIRECCION_SANIDAD = "/hato?vista=sanidad";
export const DIRECCION_CORRALES = "/hato?vista=corrales";

/** Las vistas de trabajo del Hato (chips junto a los filtros de animales): lo que se arma o se aplica sobre varios animales. */
export type VistaHato = { id: "ordeno" | "ceba" | "empadronamiento" | "sanidad" | "corrales"; href: string; texto: string };

/** Qué vistas ofrece el Hato según lo que la persona puede ver, en el orden en que aparecen. */
export function vistasHato(ver: { leche: boolean; carne: boolean; repro: boolean; sanidad: boolean; corrales: boolean }): VistaHato[] {
  return [
    ...(ver.leche ? ([{ id: "ordeno", href: DIRECCION_ORDENO, texto: "Ordeño" }] as const) : []),
    ...(ver.carne ? ([{ id: "ceba", href: DIRECCION_CEBA, texto: "Ceba" }] as const) : []),
    ...(ver.repro ? ([{ id: "empadronamiento", href: DIRECCION_EMPADRONAMIENTO, texto: "Empadronamiento" }] as const) : []),
    ...(ver.sanidad ? ([{ id: "sanidad", href: DIRECCION_SANIDAD, texto: "Sanidad" }] as const) : []),
    ...(ver.corrales ? ([{ id: "corrales", href: DIRECCION_CORRALES, texto: "Corrales" }] as const) : []),
  ];
}
