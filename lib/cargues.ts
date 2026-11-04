/** Los cargues de Excel de una finca, como los muestra «Cargues anteriores». */
export type CargueVista = {
  id: string;
  tipo: "animales" | "pesajes" | "ordenos" | "sanidad";
  archivo: string | null;
  modo: "nuevos" | "completar" | "corregir";
  creados: number;
  actualizados: number;
  estado: "aplicada" | "deshecha";
  created_at: string;
  /** Une los tramos de un archivo grande (se cargó de 500 en 500): se ven y se deshacen como uno solo. */
  grupo?: string | null;
};

/** Los tramos de un mismo archivo se juntan en una sola fila (suman lo que cargaron y se deshacen juntos). La lista llega del más nuevo al más viejo. */
export function agruparTramos(cargues: CargueVista[]): CargueVista[] {
  const salida: CargueVista[] = [];
  const porGrupo = new Map<string, CargueVista>();
  for (const c of cargues) {
    if (!c.grupo) {
      salida.push(c);
      continue;
    }
    const previo = porGrupo.get(c.grupo);
    if (!previo) {
      const copia = { ...c };
      porGrupo.set(c.grupo, copia);
      salida.push(copia);
    } else {
      previo.creados += c.creados;
      previo.actualizados += c.actualizados;
      if (c.estado === "aplicada") previo.estado = "aplicada";
    }
  }
  return salida;
}
