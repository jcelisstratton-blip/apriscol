import type { SupabaseClient } from "@supabase/supabase-js";
import type { CebaAnimal, Database } from "@/lib/tipos";
import { leerTodo } from "@/lib/consultas";
import { entraEnCeba } from "@/lib/ceba-candidatos";
import { sumarDias } from "@/lib/fechas";

/** Días desde el último peso para que un animal sin lote siga apareciendo en Ceba. */
export const DIAS_RECIENTE_CEBA = 90;

type FilaCeba = CebaAnimal;

/**
 * Qué animales están en ceba hoy: en un lote abierto, machos marcados de carne o pesados hace poco. Una sola definición para Hato → Ceba y
 * para la copia del registro sin señal (`lib/campo-servidor.ts`).
 */
export async function leerCeba(supabase: SupabaseClient<Database>, fincaId: string, hoy: string) {
  const [lotesDB, cebaDB, machosDB] = await Promise.all([
    supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", fincaId).is("cerrado_en", null).order("nombre").limit(500),
    supabase.rpc("ceba_animales", { p_finca: fincaId }),
    leerTodo((d, h) => supabase.from("animales").select("id, lote_ceba_id").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).eq("uso_macho", "carne").order("id").range(d, h)),
  ]);
  const lotes = lotesDB.data ?? [];
  const abiertos = new Set(lotes.map((l) => l.id));
  const datos = new Map<string, FilaCeba>((cebaDB.data ?? []).map((c) => [c.animal_id, c]));
  const reciente = sumarDias(hoy, -DIAS_RECIENTE_CEBA);

  const ids = new Set<string>();
  const loteDe = new Map<string, string | null>();
  for (const c of datos.values()) {
    // Un animal de un lote ya cerrado no sale de ceba aquí por estar cerrado: se ve solo si lo pesaron de verdad hace poco
    // (el peso al nacer no cuenta: ver `entraEnCeba`).
    const { entra, enLoteAbierto } = entraEnCeba(c, abiertos, reciente);
    if (entra) {
      ids.add(c.animal_id);
      loteDe.set(c.animal_id, enLoteAbierto ? c.lote_id : null);
    }
  }
  for (const m of machosDB.data ?? []) {
    ids.add(m.id);
    loteDe.set(m.id, m.lote_ceba_id && abiertos.has(m.lote_ceba_id) ? m.lote_ceba_id : null);
  }
  return { lotes, datos, ids, loteDe };
}
