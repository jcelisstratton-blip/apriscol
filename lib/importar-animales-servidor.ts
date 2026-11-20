import type { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import type { PlanId, RolFinca } from "@/lib/tipos";
import type { Especie } from "@/lib/tipos";
import type { RazaRef, UbicacionRef } from "@/lib/importar-animales";
import { construirPlantillaAnimales } from "@/lib/importar-animales-excel";

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

/**
 * La plantilla de animales de esta finca: con sus especies, razas y corrales en los desplegables, y las columnas que su rol y su plan permiten.
 * La usan la descarga suelta (`/hato/importar/plantilla`) y la de «Llevar las plantillas al campo». `null` si no se pudo leer la finca.
 */
export async function plantillaAnimalesDeFinca(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  finca: { id: string; nombre: string; plan: PlanId; especies: Especie[] },
  rol: RolFinca,
): Promise<Buffer | null> {
  const [razas, opciones] = await Promise.all([
    supabase.from("razas").select("id, especie, nombre").in("especie", finca.especies).order("nombre"),
    opcionesImportar(supabase, finca, rol),
  ]);
  if (razas.error || opciones.error) return null;
  return construirPlantillaAnimales({
    finca: finca.nombre,
    especies: finca.especies,
    razas: (razas.data ?? []) as RazaRef[],
    reproduccion: opciones.reproduccion,
    ubicaciones: opciones.ubicaciones,
  });
}
