import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Especie } from "@/lib/tipos";

export type FiltroHato = "todos" | "hembras" | "machos" | "caprino" | "ovino" | "bajas";

/** Los filtros de la lista de animales, en el orden en que se ven (Cabras y Ovejas solo si la finca tiene las dos especies). */
export function filtrosHato(especies: Especie[]): { id: FiltroHato; texto: string; detalle: string }[] {
  return [
    { id: "todos", texto: "Todos", detalle: "Todo el hato activo" },
    { id: "hembras", texto: "Hembras", detalle: "Las que paren y producen" },
    { id: "machos", texto: "Machos", detalle: "Reproductores y carne" },
    ...(especies.length > 1
      ? ([
          { id: "caprino", texto: "Cabras", detalle: "Tu rebaño caprino" },
          { id: "ovino", texto: "Ovejas", detalle: "Tu rebaño ovino" },
        ] as const)
      : []),
    { id: "bajas", texto: "Dados de baja", detalle: "Vendidos, muertos y salidos" },
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
export const DIRECCION_GASTOS = "/hato?vista=gastos";

/** Las vistas de trabajo del Hato (chips junto a los filtros de animales): lo que se arma o se aplica sobre varios animales. */
export type VistaHato = { id: "ordeno" | "ceba" | "empadronamiento" | "sanidad" | "corrales" | "gastos"; href: string; texto: string; detalle: string };

/** Qué vistas ofrece el Hato según lo que la persona puede ver, en el orden en que aparecen. */
export function vistasHato(ver: { leche: boolean; carne: boolean; repro: boolean; sanidad: boolean; corrales: boolean; gastos: boolean }): VistaHato[] {
  return [
    ...(ver.leche ? ([{ id: "ordeno", href: DIRECCION_ORDENO, texto: "Ordeño", detalle: "Registrar y programar turnos" }] as const) : []),
    ...(ver.carne ? ([{ id: "ceba", href: DIRECCION_CEBA, texto: "Ceba", detalle: "Pesos, lotes y candidatos" }] as const) : []),
    ...(ver.repro ? ([{ id: "empadronamiento", href: DIRECCION_EMPADRONAMIENTO, texto: "Empadronamiento", detalle: "Temporada de monta" }] as const) : []),
    ...(ver.sanidad ? ([{ id: "sanidad", href: DIRECCION_SANIDAD, texto: "Sanidad", detalle: "Vacunas y tratamientos" }] as const) : []),
    ...(ver.corrales ? ([{ id: "corrales", href: DIRECCION_CORRALES, texto: "Corrales", detalle: "Dónde está cada animal" }] as const) : []),
    ...(ver.gastos ? ([{ id: "gastos", href: DIRECCION_GASTOS, texto: "Gastos", detalle: "Lo que cuesta el hato" }] as const) : []),
  ];
}

/** Cuántos animales tiene cada filtro (para el dato de cada tarjeta). Las especies solo se cuentan si la finca tiene las dos. */
export async function conteosHato(supabase: SupabaseClient<Database>, fincaId: string, especies: Especie[]): Promise<Record<FiltroHato, number>> {
  const base = (activo: boolean) => {
    const q = supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).is("deleted_at", null);
    return activo ? q.eq("estado", "activo") : q.neq("estado", "activo");
  };
  const dosEspecies = especies.length > 1;
  const [todos, hembras, machos, caprino, ovino, bajas] = await Promise.all([
    base(true),
    base(true).eq("sexo", "hembra"),
    base(true).eq("sexo", "macho"),
    dosEspecies ? base(true).eq("especie", "caprino") : Promise.resolve({ count: 0 }),
    dosEspecies ? base(true).eq("especie", "ovino") : Promise.resolve({ count: 0 }),
    base(false),
  ]);
  return { todos: todos.count ?? 0, hembras: hembras.count ?? 0, machos: machos.count ?? 0, caprino: caprino.count ?? 0, ovino: ovino.count ?? 0, bajas: bajas.count ?? 0 };
}

/** «1 animal» o «42 animales». */
export const textoAnimales = (n: number) => `${n} ${n === 1 ? "animal" : "animales"}`;
