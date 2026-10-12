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
