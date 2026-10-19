import { ListaLotes } from "@/components/ListaLotes";
import { crearClienteServidor } from "@/lib/supabase/server";
import { filasLotes } from "@/lib/carne";
import { obtenerAjustes } from "@/lib/ajustes-servidor";

/** Los lotes de ceba con lo que lleva cada uno. */
export async function Lotes({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const [lotes, estadisticas] = await Promise.all([
    supabase.from("lotes_ceba").select("*").eq("finca_id", fincaId).order("fecha_inicio", { ascending: false }).limit(500),
    supabase.rpc("ceba_lotes", { p_finca: fincaId }),
  ]);
  const { general } = await obtenerAjustes();
  return <ListaLotes lotes={filasLotes(lotes.data ?? [], estadisticas.data ?? [])} puedeEditar={puedeEditar} gdpMinima={general.gdp_minima_g} />;
}
