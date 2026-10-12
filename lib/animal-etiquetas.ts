import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";

export type AnimalCorto = { id: string; numero_arete: string; nombre: string | null };

/** Arete y nombre de muchos animales a la vez. Los pide por tramos de 100 para no pasar el largo máximo de una dirección. */
export async function animalesPorIds(supabase: SupabaseClient<Database>, fincaId: string, ids: string[]): Promise<AnimalCorto[]> {
  const unicos = [...new Set(ids)];
  const tramos: string[][] = [];
  for (let i = 0; i < unicos.length; i += 100) tramos.push(unicos.slice(i, i + 100));
  const respuestas = await Promise.all(tramos.map((t) => supabase.from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).in("id", t)));
  return respuestas.flatMap((r) => r.data ?? []).sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));
}
