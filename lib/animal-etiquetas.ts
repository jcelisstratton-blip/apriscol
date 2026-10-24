import type { SupabaseClient } from "@supabase/supabase-js";
import { enTramos } from "@/lib/consultas";
import type { Database } from "@/lib/tipos";

export type AnimalCorto = { id: string; numero_arete: string; nombre: string | null };

/** Arete y nombre de muchos animales a la vez. Los pide por tramos de 100 para no pasar el largo máximo de una dirección. */
export async function animalesPorIds(supabase: SupabaseClient<Database>, fincaId: string, ids: string[]): Promise<AnimalCorto[]> {
  const respuestas = await Promise.all(enTramos([...new Set(ids)]).map((t) => supabase.from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).in("id", t)));
  return respuestas.flatMap((r) => r.data ?? []).sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));
}
