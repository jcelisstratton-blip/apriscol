/** Los reportes que se descargan en Excel desde el menú Costos. */
export type ReporteId = "rubros" | "meses" | "detalle" | "animales" | "pendientes" | "resultado";
export const REPORTES: { id: ReporteId; titulo: string; descripcion: string; contiene: string }[] = [
  { id: "resultado", titulo: "Resultado del periodo", descripcion: "Lo que entró, lo que costó y lo que quedó", contiene: "Ingresos, costos, resultado, costo por litro, saca y mortalidad, y el detalle mes a mes" },
  { id: "rubros", titulo: "Gastos por rubro", descripcion: "En qué se va la plata", contiene: "Cada rubro con su total, su peso en el gasto y lo que sigue por pagar" },
  { id: "meses", titulo: "Costos e ingresos por mes", descripcion: "Cómo se movió mes a mes", contiene: "Costos, ingresos de leche y de animales, litros y costo por litro de cada mes" },
  { id: "detalle", titulo: "Detalle de costos", descripcion: "Todos los movimientos, uno por uno", contiene: "Gastos, tratamientos y alimento de ceba con fecha, proveedor, a quién se cargó y estado de pago" },
  { id: "animales", titulo: "Costo por animal", descripcion: "Cuánto ha costado cada animal", contiene: "Costo directo, costo repartido y total por animal, con su valor de compra" },
  { id: "pendientes", titulo: "Gastos por pagar", descripcion: "Lo que se debe y cuándo vence", contiene: "Cada gasto sin pagar con su vencimiento y los días de atraso" },
];
export const ES_REPORTE = (v: string | null | undefined): v is ReporteId => REPORTES.some((r) => r.id === v);

/** La dirección que descarga un reporte con el periodo (y, en el detalle, el grupo) de la pantalla. */
export function direccionExportar(reporte: ReporteId, f: { periodo: string; desde?: string; hasta?: string; grupo?: string | null }): string {
  const q = new URLSearchParams({ reporte });
  if (f.periodo !== "todo") q.set("periodo", f.periodo);
  if (f.periodo === "rango") {
    if (f.desde) q.set("desde", f.desde);
    if (f.hasta) q.set("hasta", f.hasta);
  }
  if (f.grupo) q.set("grupo", f.grupo);
  return `/costos/exportar?${q.toString()}`;
}
