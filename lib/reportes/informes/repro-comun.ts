import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_SERVICIO } from "@/lib/reproduccion";
import { cargarAnimales, enTramos, pasaEspecie, traerTodo } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import type { DiagnosticoGestacion, ReproHembra, Servicio } from "@/lib/tipos";

export type ServicioBase = Pick<Servicio, "id" | "hembra_id" | "fecha" | "tipo" | "macho_id" | "macho_externo">;
export type DiagnosticoBase = Pick<DiagnosticoGestacion, "id" | "hembra_id" | "servicio_id" | "fecha" | "resultado" | "num_fetos">;

/** Las hembras activas con su estado reproductivo (de la vista), ya separadas por la especie elegida, y los animales para ponerles nombre. */
export async function cargarReproBase(c: ContextoReporte): Promise<{ repro: ReproHembra[]; animales: Map<string, AnimalBase>; truncado: boolean }> {
  const [animales, repro] = await Promise.all([
    cargarAnimales(c),
    traerTodo<ReproHembra>((d, h) => c.supabase.from("v_repro_hembras").select("*").eq("finca_id", c.fincaId).order("animal_id").range(d, h)),
  ]);
  return {
    repro: repro.filas.filter((r) => pasaEspecie(c, r.especie) && animales.porId.has(r.animal_id)),
    animales: animales.porId,
    truncado: animales.truncado || repro.truncado,
  };
}

/** Los servicios por su id. */
export async function cargarServicios(c: Pick<ContextoReporte, "supabase" | "fincaId">, ids: string[]): Promise<Map<string, ServicioBase>> {
  const respuestas = await Promise.all(
    enTramos([...new Set(ids)]).map((t) => c.supabase.from("servicios").select("id, hembra_id, fecha, tipo, macho_id, macho_externo").eq("finca_id", c.fincaId).in("id", t)),
  );
  return new Map(respuestas.flatMap((r) => r.data ?? []).map((s) => [s.id, s as ServicioBase]));
}

/** Quién fue el reproductor de un servicio: el macho del hato (arete y nombre) o el nombre escrito de uno de fuera. */
export function reproductorDe(s: Pick<ServicioBase, "macho_id" | "macho_externo"> | undefined, animales: Map<string, AnimalBase>): string | null {
  if (!s) return null;
  const interno = s.macho_id ? animales.get(s.macho_id) : undefined;
  if (interno) return etiquetaAnimal(interno);
  return s.macho_externo?.trim() || null;
}

export const tipoServicio = (s: Pick<ServicioBase, "tipo"> | undefined) => (s ? (ETIQUETA_SERVICIO[s.tipo] ?? s.tipo) : null);
