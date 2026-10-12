import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * El sexo y la especie de un animal solo se pueden corregir mientras no tenga historia que dependa de ellos
 * (hijos, lactancias, ordeños o partos). Devuelve la razón en lenguaje de persona, o `null` si se pueden cambiar.
 * Cuando reproducción tenga interfaz (servicios, celos, diagnósticos), sumar aquí esas tablas.
 */
export async function motivoBloqueoIdentidad(supabase: Cliente, animalId: string, fincaId: string): Promise<string | null> {
  const contar = (r: { count: number | null }) => r.count ?? 0;
  const [hijos, lactancias, ordenos, partos] = await Promise.all([
    supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).is("deleted_at", null).or(`padre_id.eq.${animalId},madre_id.eq.${animalId}`),
    supabase.from("lactancias").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).eq("animal_id", animalId),
    supabase.from("ordenos").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).eq("animal_id", animalId),
    supabase.from("partos").select("id", { count: "exact", head: true }).eq("finca_id", fincaId).eq("madre_id", animalId),
  ]);
  if (contar(hijos) + contar(lactancias) + contar(ordenos) + contar(partos) > 0) {
    return "Ya tiene crías, leche o partos registrados, y cambiarle el sexo o la especie dañaría esa información.";
  }
  return null;
}
