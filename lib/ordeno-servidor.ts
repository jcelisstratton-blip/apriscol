import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";
import { enTramos, leerTodo } from "@/lib/consultas";

export type HembraEnLeche = { id: string; numero_arete: string; nombre: string | null; turnos_ordeno: string[] | null };

/**
 * Las hembras con lactancia abierta (las que se ordeñan) y hasta qué día está en retiro de leche cada una. Una sola definición para la
 * captura de leche (`Registrar`) y para la copia del registro sin señal (`lib/campo-servidor.ts`). Lee todas las filas (PostgREST corta en 1000).
 */
export async function hembrasEnLeche(supabase: SupabaseClient<Database>, fincaId: string): Promise<{ ids: string[]; animales: HembraEnLeche[]; retiros: Record<string, string> }> {
  const [lactancias, retiro] = await Promise.all([
    leerTodo((d, h) => supabase.from("lactancias").select("id, animal_id").eq("finca_id", fincaId).is("fecha_secado", null).order("id").range(d, h)),
    supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
  ]);
  const ids = [...new Set(lactancias.data.map((l) => l.animal_id))];
  const tramos = await Promise.all(
    enTramos(ids).map((t) => supabase.from("animales").select("id, numero_arete, nombre, turnos_ordeno").eq("finca_id", fincaId).in("id", t).eq("estado", "activo").is("deleted_at", null)),
  );
  const animales = tramos.flatMap((r) => (r.data ?? []) as HembraEnLeche[]).sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));
  const retiros = Object.fromEntries((retiro.data ?? []).filter((r) => r.retiro_leche_hasta).map((r) => [r.animal_id, r.retiro_leche_hasta!]));
  return { ids, animales, retiros };
}
