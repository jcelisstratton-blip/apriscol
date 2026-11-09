import "server-only";
import { RUBROS_ALIMENTO } from "@/lib/inventario-alimento";
import { puedeCargar } from "@/lib/importar-historia";
import { pasosMigracion, type ConteosMigracion, type PasoMigracion } from "@/lib/migracion";
import { puedeEscribir } from "@/lib/permisos";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { PlanId, RolFinca } from "@/lib/tipos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Los pasos de «Migrar mi finca» con su estado real (se cuenta lo que ya hay cargado), para la guía (`/hato/migrar`) y para el aviso de Hoy. Una sola definición:
 * lo que dice el aviso y lo que dice la guía nunca se contradicen.
 */
export async function cargarPasosMigracion(supabase: Cliente, finca: { id: string; plan: PlanId }, rol: RolFinca): Promise<PasoMigracion[]> {
  const contar = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
  const f = finca.id;
  const head = { count: "exact", head: true } as const;
  const permisos = {
    hato: true,
    corrales: puedeCargar("corrales", rol, finca.plan),
    reproduccion: puedeEscribir(rol, "reproduccion", finca.plan),
    carne: puedeCargar("pesajes", rol, finca.plan),
    leche: puedeCargar("ordenos", rol, finca.plan),
    sanidad: puedeCargar("sanidad", rol, finca.plan),
    medicamentos: puedeCargar("medicamentos", rol, finca.plan),
    alimento: puedeCargar("alimento", rol, finca.plan),
  };
  const activos = () => supabase.from("animales").select("id", head).eq("finca_id", f).eq("estado", "activo").is("deleted_at", null);
  const [ubicaciones, animales, desdeExcel, conPadres, servicios, lactancias, pesajes, ordenos, eventosSanitarios, productosVet, aperturasVet, alimentos, aperturasAlimento] = await Promise.all([
    contar(supabase.from("v_ubicaciones").select("id", head).eq("finca_id", f).eq("activa", true)),
    contar(activos()),
    contar(activos().not("importacion_id", "is", null)),
    contar(activos().or("padre_id.not.is.null,madre_id.not.is.null,padre_externo.not.is.null,madre_externa.not.is.null")),
    contar(supabase.from("servicios").select("id", head).eq("finca_id", f)),
    contar(supabase.from("lactancias").select("id", head).eq("finca_id", f)),
    contar(supabase.from("pesajes").select("id", head).eq("finca_id", f)),
    contar(supabase.from("ordenos").select("id", head).eq("finca_id", f)),
    contar(supabase.from("eventos_sanitarios").select("id", head).eq("finca_id", f)),
    contar(supabase.from("productos_veterinarios").select("id", head).eq("finca_id", f)),
    contar(supabase.from("inventario_movimientos").select("id", head).eq("finca_id", f).eq("tipo", "apertura")),
    contar(supabase.from("finca_productos").select("id", head).eq("finca_id", f).eq("tipo", "compra").in("rubro", [...RUBROS_ALIMENTO])),
    contar(supabase.from("inventario_alimento_movimientos").select("id", head).eq("finca_id", f).eq("tipo", "apertura")),
  ]);
  const conteos: ConteosMigracion = { ubicaciones, animales, desdeExcel, conPadres, servicios, lactancias, pesajes, ordenos, eventosSanitarios, productosVet, aperturasVet, alimentos, aperturasAlimento };
  return pasosMigracion(conteos, permisos);
}
