import type { UbicacionVista } from "@/lib/tipos";

/**
 * Sugerencias de a dónde pasar animales de un corral o potrero. Solo salen de lo que la finca ya tiene registrado (capacidad, ocupantes, días de descanso) y son eso,
 * sugerencias: nada se mueve sin que la persona lo confirme. Si falta un dato (por ejemplo, la capacidad del destino), esa instalación no se sugiere.
 */

export type SugerenciaDestino = { id: string; nombre: string; /** Por qué sirve, en una frase corta: «caben 6 más (4 de 10)». */ motivo: string; libres: number };

/** Instalaciones con un fin especial: no se sugieren como destino de un traslado cualquiera. */
const USOS_ESPECIALES = ["cuarentena", "maternidad", "ordeno"];

/**
 * Hasta `max` instalaciones a las que se pueden pasar `necesarios` animales sin que ninguna pase su cupo: del mismo tipo que el origen (corral con corral, potrero con
 * potrero), activas, sin fin especial, con capacidad definida y espacio suficiente. Un potrero solo se sugiere si ya descansó lo que necesitaba (o nunca se ha usado).
 * Primero las del mismo uso; luego las que más espacio tienen.
 */
export function sugerirDestinos(
  origen: Pick<UbicacionVista, "id" | "tipo" | "uso">,
  necesarios: number,
  todas: Pick<UbicacionVista, "id" | "nombre" | "tipo" | "uso" | "activa" | "capacidad" | "ocupantes" | "hacinada" | "estado" | "dias_descanso">[],
  max = 3,
): SugerenciaDestino[] {
  if (!Number.isFinite(necesarios) || necesarios < 1) return [];
  return todas
    .filter((u) => u.activa && u.id !== origen.id && u.tipo === origen.tipo && !u.hacinada && !USOS_ESPECIALES.includes(u.uso))
    .filter((u) => (u.tipo === "potrero" ? u.estado === "listo" || u.estado === "vacio" : true))
    .filter((u) => typeof u.capacidad === "number" && u.capacidad > 0 && u.capacidad - u.ocupantes >= necesarios)
    .map((u) => {
      const libres = (u.capacidad as number) - u.ocupantes;
      const espacio = `caben ${libres} más (${u.ocupantes} de ${u.capacidad})`;
      const motivo = u.tipo === "potrero" ? `${u.dias_descanso == null ? "sin uso todavía" : `descansó ${u.dias_descanso} días`}, ${espacio}` : espacio;
      return { id: u.id, nombre: u.nombre, motivo, libres, mismoUso: u.uso === origen.uso };
    })
    .sort((a, b) => Number(b.mismoUso) - Number(a.mismoUso) || b.libres - a.libres || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, max)
    .map(({ id, nombre, motivo, libres }) => ({ id, nombre, motivo, libres }));
}
