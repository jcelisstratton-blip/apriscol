import "server-only";
import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Los productos veterinarios que ya tienen conteo de apertura (los que el inventario de bodega sigue). Quien no ve el inventario recibe una lista vacía:
 * el formulario simplemente no muestra los avisos de inventario.
 */
export async function cargarProductosInventariados(supabase: Cliente, fincaId: string): Promise<string[]> {
  const { data } = await supabase.from("inventario_movimientos").select("producto_vet_id").eq("finca_id", fincaId).eq("tipo", "apertura").limit(1000);
  return [...new Set((data ?? []).map((m) => m.producto_vet_id))];
}
