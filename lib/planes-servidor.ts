import type { crearClienteServidor } from "@/lib/supabase/server";
import type { RolFinca } from "@/lib/tipos";

/**
 * El lugar de una finca entre las del propietario (1 = la primera). Decide el descuento: la primera paga completo, desde la segunda 10 % menos.
 * Solo cuentan las fincas de las que la persona es propietaria.
 */
export async function numeroDeFinca(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  fincas: { id: string; rol: RolFinca }[],
  fincaId: string,
): Promise<number> {
  const propias = fincas.filter((f) => f.rol === "propietario").map((f) => f.id);
  if (propias.length === 0) return 1;
  const { data } = await supabase.from("fincas").select("id, created_at").in("id", propias);
  const ordenadas = [...(data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return Math.max(1, ordenadas.findIndex((f) => f.id === fincaId) + 1);
}
