import type { SupabaseClient } from "@supabase/supabase-js";
import { leerTodo } from "@/lib/consultas";
import { coberturaEfectiva, ESQUILA_AVISO_DIAS, ESQUILA_CADA_MESES, plazoEsquila, type CoberturaEfectiva, type PlazoEsquila } from "@/lib/esquila";
import type { CoberturaRaza, Database } from "@/lib/tipos";

export type OvejaEsquila = {
  id: string;
  numero_arete: string;
  nombre: string | null;
  cobertura: CoberturaEfectiva;
  /** Solo las de lana llevan plazo. */
  plazo: PlazoEsquila | null;
  ultima: string | null;
  vellonTotalKg: number | null;
};

/**
 * Todas las ovejas activas de la finca con su cobertura (la de la oveja, o la de su raza) y, si son de lana, cuándo les toca la esquila.
 * Lee todas las filas (PostgREST corta cada respuesta en 1000).
 */
export async function cargarOvejasEsquila(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  hoy: string,
  plazo: { cadaMeses: number; avisoDias: number } = { cadaMeses: ESQUILA_CADA_MESES, avisoDias: ESQUILA_AVISO_DIAS },
): Promise<OvejaEsquila[]> {
  const [ovinos, razas, esquilas] = await Promise.all([
    leerTodo((d, h) =>
      supabase.from("animales").select("id, numero_arete, nombre, raza_id, cobertura").eq("finca_id", fincaId).eq("especie", "ovino").eq("estado", "activo").is("deleted_at", null).order("id").range(d, h),
    ),
    supabase.from("razas").select("id, cobertura").eq("especie", "ovino"),
    leerTodo((d, h) => supabase.from("v_esquila_animal").select("animal_id, ultima_fecha, vellon_total_kg").eq("finca_id", fincaId).order("animal_id").range(d, h)),
  ]);
  const deRaza = new Map((razas.data ?? []).map((r) => [r.id, (r.cobertura ?? null) as CoberturaRaza | null]));
  const deOveja = new Map(esquilas.data.map((e) => [e.animal_id, e]));

  return ovinos.data
    .map((a) => {
      const cobertura = coberturaEfectiva("ovino", a.cobertura, a.raza_id ? (deRaza.get(a.raza_id) ?? null) : null) ?? "por_definir";
      const e = deOveja.get(a.id);
      const ultima = e?.ultima_fecha ?? null;
      return {
        id: a.id,
        numero_arete: a.numero_arete,
        nombre: a.nombre,
        cobertura,
        plazo: cobertura === "lana" ? plazoEsquila(ultima, hoy, plazo.cadaMeses, plazo.avisoDias) : null,
        ultima,
        vellonTotalKg: e?.vellon_total_kg ?? null,
      };
    })
    .sort((x, y) => x.numero_arete.localeCompare(y.numero_arete, "es", { numeric: true }));
}
