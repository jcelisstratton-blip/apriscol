import type { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import type { PlanId, RolFinca } from "@/lib/tipos";
import type { UbicacionRef } from "@/lib/importar-animales";

/**
 * Qué puede traer el archivo además del animal: servicio y preñez (módulo de reproducción) y corral o potrero (módulo de corrales, que
 * depende del plan). Se calcula con el rol y el plan de la finca activa; la plantilla solo ofrece esas columnas y la validación las exige.
 */
export async function opcionesImportar(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  finca: { id: string; plan: PlanId },
  rol: RolFinca,
): Promise<{ reproduccion: boolean; ubicaciones?: UbicacionRef[]; error?: string }> {
  const reproduccion = puedeEscribir(rol, "reproduccion", finca.plan);
  if (!puedeEscribir(rol, "corrales", finca.plan)) return { reproduccion };
  const { data, error } = await supabase
    .from("v_ubicaciones")
    .select("id, nombre, capacidad, ocupantes")
    .eq("finca_id", finca.id)
    .eq("activa", true)
    .order("nombre");
  if (error) return { reproduccion, error: error.message };
  return { reproduccion, ubicaciones: (data ?? []).map((u) => ({ id: u.id!, nombre: u.nombre!, capacidad: u.capacidad ?? null, ocupantes: u.ocupantes ?? 0 })) };
}
