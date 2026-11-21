import "server-only";
import type { crearClienteServidor } from "@/lib/supabase/server";
import { RUBROS_ALIMENTO } from "@/lib/inventario-alimento";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Los destinos al anotar lo que se dio de comer: viven en `lib/alimento-reglas.ts` (también los usa la copia de «Registrar sin señal»). */
export { cargarDestinosSalida } from "@/lib/alimento-reglas";

/** Los alimentos del catálogo de la finca (los mismos que cuenta el inventario de alimento): lo que se ofrece al anotar el consumo de un lote. */
/** `incluir`: el alimento que ya tiene un registro que se corrige, aunque se haya desactivado después. */
export async function cargarAlimentosCatalogo(supabase: Cliente, fincaId: string, incluir?: string | null): Promise<{ valor: string; etiqueta: string }[]> {
  const { data } = await supabase
    .from("finca_productos")
    .select("id, nombre")
    .eq("finca_id", fincaId)
    .eq("tipo", "compra")
    .or(incluir ? `activo.eq.true,id.eq.${incluir}` : "activo.eq.true")
    .in("rubro", [...RUBROS_ALIMENTO])
    .order("nombre")
    .limit(300);
  return (data ?? []).map((a) => ({ valor: a.id, etiqueta: a.nombre }));
}
