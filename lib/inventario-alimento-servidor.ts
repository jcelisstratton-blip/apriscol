import "server-only";
import type { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVer } from "@/lib/permisos";
import type { DestinoSalida } from "@/components/FormSalidaAlimento";
import type { PlanId, RolFinca } from "@/lib/tipos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Los destinos que se ofrecen al anotar lo que se dio de comer: los corrales y potreros activos (a quien ve Corrales) y los lotes de ceba abiertos (a quien ve Carne).
 * El ordeñador no ve ninguno de los dos módulos: para él la salida no lleva destino.
 */
export async function cargarDestinosSalida(supabase: Cliente, finca: { id: string; plan: PlanId }, rol: RolFinca): Promise<DestinoSalida[]> {
  const [ubicaciones, lotes] = await Promise.all([
    puedeVer(rol, "corrales", finca.plan) ? supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).eq("activa", true).order("nombre").limit(300) : Promise.resolve({ data: [] }),
    puedeVer(rol, "carne", finca.plan) ? supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", finca.id).is("cerrado_en", null).order("nombre").limit(300) : Promise.resolve({ data: [] }),
  ]);
  return [
    ...(ubicaciones.data ?? []).map((u) => ({ valor: `ubicacion:${u.id}`, etiqueta: u.nombre, detalle: "Corral o potrero" })),
    ...(lotes.data ?? []).map((l) => ({ valor: `lote:${l.id}`, etiqueta: l.nombre, detalle: "Lote de ceba" })),
  ];
}
