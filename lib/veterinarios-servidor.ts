import type { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import type { VeterinarioRef } from "@/lib/veterinarios";
import type { RolFinca } from "@/lib/tipos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Los veterinarios activos del equipo para ofrecerlos al registrar quién asistió un procedimiento, y si quien registra puede agregar uno desde ahí (solo el
 * propietario o un administrador, y solo si el plan incluye personal). La función de la base entrega apenas nombre y tarjeta profesional, nada del contrato.
 * Si falla (o el plan no tiene personal) la lista queda vacía y el formulario deja escribir el nombre de otra persona.
 */
export async function cargarVeterinarios(supabase: Cliente, finca: { id: string; plan: Parameters<typeof puedeEscribir>[2] }, rol: RolFinca): Promise<{ veterinarios: VeterinarioRef[]; puedeAgregar: boolean }> {
  const { data, error } = await supabase.rpc("veterinarios_finca", { p_finca: finca.id });
  return {
    veterinarios: error || !data ? [] : (data as VeterinarioRef[]),
    puedeAgregar: puedeGestionar(rol) && puedeEscribir(rol, "contabilidad", finca.plan),
  };
}
