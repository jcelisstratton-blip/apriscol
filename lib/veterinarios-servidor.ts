import type { crearClienteServidor } from "@/lib/supabase/server";
import type { VeterinarioRef } from "@/lib/veterinarios";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Los veterinarios activos del equipo, para ofrecerlos al registrar un procedimiento. Solo nombre y tarjeta profesional: la función de la base no entrega
 * nada más del contrato. Si falla (o el plan no tiene personal) devuelve una lista vacía y el formulario pide el nombre escrito.
 */
export async function veterinariosDeLaFinca(supabase: Cliente, fincaId: string): Promise<VeterinarioRef[]> {
  const { data, error } = await supabase.rpc("veterinarios_finca", { p_finca: fincaId });
  if (error || !data) return [];
  return data as VeterinarioRef[];
}
