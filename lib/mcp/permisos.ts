/**
 * Los permisos que la persona le dio a asistentes (Claude, por ejemplo). Cada vez que alguien conecta Claude, Claude se registra como un cliente nuevo en
 * Supabase: la misma persona puede acabar con varios permisos «Claude». Para ella es una sola conexión, así que se agrupan por nombre.
 */
export type Permiso = { clientId: string; nombre: string; concedido: string };
export type GrupoPermiso = { clientIds: string[]; nombre: string; ultimo: string };

export const NOMBRE_POR_DEFECTO = "Asistente de IA";

export function agruparPermisos(permisos: Permiso[]): GrupoPermiso[] {
  const grupos = new Map<string, GrupoPermiso>();
  for (const p of permisos) {
    const nombre = p.nombre?.trim() || NOMBRE_POR_DEFECTO;
    const clave = nombre.toLowerCase();
    const g = grupos.get(clave);
    if (!g) grupos.set(clave, { clientIds: [p.clientId], nombre, ultimo: p.concedido });
    else {
      if (!g.clientIds.includes(p.clientId)) g.clientIds.push(p.clientId);
      if (p.concedido > g.ultimo) g.ultimo = p.concedido;
    }
  }
  return [...grupos.values()].sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
}
