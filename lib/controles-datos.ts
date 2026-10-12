import type { SupabaseClient } from "@supabase/supabase-js";
import type { ControlCalidad, Database } from "@/lib/tipos";

/** Los controles de varios despachos o animales a la vez, pedidos por tramos de 100 para no pasar el largo máximo de una dirección. */
export async function controlesDe(
  supabase: SupabaseClient<Database>,
  fincaId: string,
  columna: "despacho_id" | "animal_id",
  ids: string[],
): Promise<ControlCalidad[]> {
  const unicos = [...new Set(ids)];
  const tramos: string[][] = [];
  for (let i = 0; i < unicos.length; i += 100) tramos.push(unicos.slice(i, i + 100));
  const respuestas = await Promise.all(tramos.map((t) => supabase.from("controles_calidad").select("*").eq("finca_id", fincaId).in(columna, t)));
  return respuestas.flatMap((r) => (r.data ?? []) as ControlCalidad[]);
}

/** Agrupa los controles por el despacho o el animal al que pertenecen. */
export function agruparControles(filas: ControlCalidad[], columna: "despacho_id" | "animal_id"): Map<string, ControlCalidad[]> {
  const mapa = new Map<string, ControlCalidad[]>();
  for (const f of filas) {
    const clave = f[columna];
    if (!clave) continue;
    mapa.set(clave, [...(mapa.get(clave) ?? []), f]);
  }
  return mapa;
}
