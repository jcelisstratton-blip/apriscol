import { crearClienteNavegador } from "@/lib/supabase/client";
import type { AncestroEndogamia } from "@/lib/endogamia";

export type ResultadoSimulacion = { f: number; pedigriMacho: number; pedigriHembra: number; origen: AncestroEndogamia[] };

/** Lo que tendría la cría de un macho y una hembra del hato: endogamia, qué tan completo es cada pedigrí y de dónde viene. Lanza el error de la base si falla. */
export async function consultarCruza(machoId: string, hembraId: string): Promise<ResultadoSimulacion> {
  const supabase = crearClienteNavegador();
  const [sim, pm, ph, com] = await Promise.all([
    supabase.rpc("simular_endogamia", { p_macho: machoId, p_hembra: hembraId }),
    supabase.rpc("completitud_pedigri", { p_animal: machoId }),
    supabase.rpc("completitud_pedigri", { p_animal: hembraId }),
    supabase.rpc("explicar_cruza", { p_macho: machoId, p_hembra: hembraId }),
  ]);
  const fallo = sim.error ?? pm.error ?? ph.error ?? com.error;
  if (fallo) throw new Error(fallo.message);
  return { f: sim.data ?? 0, pedigriMacho: pm.data ?? 0, pedigriHembra: ph.data ?? 0, origen: (com.data ?? []) as AncestroEndogamia[] };
}
