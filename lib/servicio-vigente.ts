import type { crearClienteServidor } from "@/lib/supabase/server";
import { servicioEsActivo } from "@/lib/reproduccion";
import type { TipoServicio } from "@/lib/tipos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

export type ServicioVigente = { id: string; fecha: string; tipo: TipoServicio };
export type ResultadoServicioVigente =
  | { servicio: ServicioVigente; razon: null }
  | { servicio: null; razon: "sin_servicio" | "ya_vacia" };

export const MENSAJE_SIN_SERVICIO = "Esta hembra no tiene un servicio activo en este ciclo. Registra primero el servicio y luego el diagnóstico.";
export const MENSAJE_YA_VACIA = "El último diagnóstico de este servicio fue «Vacía». Para un nuevo ciclo registra un servicio; si fue un error, edita ese diagnóstico.";

/**
 * El servicio al que corresponde un diagnóstico nuevo: el último de la hembra, mientras no haya un parto o aborto desde entonces y no se haya
 * diagnosticado ya «vacía» (un ciclo cerrado). Es la misma regla de `v_repro_hembras`, pero lo calcula el servidor: el navegador no elige el servicio.
 */
export async function servicioVigente(supabase: Cliente, fincaId: string, hembraId: string): Promise<ResultadoServicioVigente> {
  const [{ data: servicio }, { data: parto }] = await Promise.all([
    supabase.from("servicios").select("id, fecha, tipo").eq("finca_id", fincaId).eq("hembra_id", hembraId).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("partos").select("fecha").eq("finca_id", fincaId).eq("madre_id", hembraId).order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!servicio || !servicioEsActivo(servicio.fecha, parto?.fecha ?? null)) return { servicio: null, razon: "sin_servicio" };
  const { data: ultimo } = await supabase.from("diagnosticos_gestacion").select("resultado").eq("finca_id", fincaId).eq("servicio_id", servicio.id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (ultimo?.resultado === "vacia") return { servicio: null, razon: "ya_vacia" };
  return { servicio, razon: null };
}
