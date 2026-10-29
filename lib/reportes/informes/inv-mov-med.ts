import { col } from "@/lib/reportes/base";
import type { ContextoReporte } from "@/lib/reportes/base";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";

export type MovimientoMed = { fecha: string; producto_id: string; producto: string; unidad: string | null; tipo: string; cantidad: number | null; lote: string | null; detalle: string; quien: string | null };
export type DatosInvMovMed = { tipo: string; movimientos: MovimientoMed[]; truncado: boolean };

const ETIQUETA: Record<string, string> = { compra: "Compra", aplicacion: "Aplicación", ajuste: "Ajuste", apertura: "Conteo de apertura" };
const TONO: Record<string, TonoFila> = { compra: "ok", aplicacion: "musgo", ajuste: "aviso", apertura: "neutro" };
/** El filtro «Conteos y ajustes» incluye la apertura. */
const pasa = (filtro: string, tipo: string) => filtro === "todos" || filtro === tipo || (filtro === "ajuste" && tipo === "apertura");
/** El servidor corta en 20.000 filas. */
export const TOPE_MOVIMIENTOS = 20000;

/** Todo lo que entró, salió o se ajustó en el periodo, el más reciente primero, con quién lo registró. Las compras y aplicaciones son las mismas que mueven las existencias. */
export function construirInvMovMed(d: DatosInvMovMed): ResultadoReporte {
  const visibles = d.movimientos.filter((m) => pasa(d.tipo, m.tipo));
  const filas: FilaReporte[] = visibles.map((m, i) => ({
    id: `${i}-${m.producto_id}-${m.fecha}-${m.tipo}`,
    titulo: m.producto,
    href: `/inventario/${m.producto_id}`,
    tono: TONO[m.tipo] ?? "neutro",
    valores: {
      producto: m.producto,
      fecha: m.fecha,
      tipo: ETIQUETA[m.tipo] ?? m.tipo,
      cantidad: m.cantidad,
      unidad: m.unidad,
      lote: m.lote,
      detalle: m.detalle,
      quien: m.quien,
    },
  }));

  const cuenta = (t: string) => d.movimientos.filter((m) => m.tipo === t).length;
  const sinSumar = d.movimientos.filter((m) => m.cantidad === null).length;
  const indicadores: Indicador[] = [
    { etiqueta: "Compras", valor: cifra(cuenta("compra")) },
    { etiqueta: "Aplicaciones", valor: cifra(cuenta("aplicacion")) },
    { etiqueta: "Conteos y ajustes", valor: cifra(cuenta("ajuste") + cuenta("apertura")) },
    { etiqueta: "Productos con movimiento", valor: cifra(new Set(d.movimientos.map((m) => m.producto_id)).size) },
  ];

  const notas: string[] = [];
  if (sinSumar > 0) notas.push(`${cifra(sinSumar)} ${sinSumar === 1 ? "movimiento no se pudo sumar" : "movimientos no se pudieron sumar"} al inventario (una compra sin cantidad o de un producto sin presentación definida, o una aplicación sin dosis). Corrígelos para que las existencias cuadren.`);
  if (d.truncado) notas.push(`El periodo tiene más de ${cifra(TOPE_MOVIMIENTOS)} movimientos: se muestran los más recientes. Elige un periodo más corto.`);

  return {
    columnas: [
      col.texto("producto", "Producto", 28, { soloExcel: true }),
      col.fecha("fecha", "Fecha", 14),
      col.texto("tipo", "Movimiento", 18, { insignia: true }),
      col.decimal("cantidad", "Cantidad", 14, 2),
      col.texto("unidad", "Unidad", 10),
      col.texto("lote", "Lote", 16),
      col.texto("detalle", "Detalle", 44),
      col.texto("quien", "Lo registró", 22),
    ],
    filas,
    indicadores,
    notas,
  };
}

export async function informeInvMovMed(c: ContextoReporte): Promise<ResultadoReporte> {
  const { data, error } = await c.supabase.rpc("inventario_movimientos_med", { p_finca: c.fincaId, p_desde: c.rango.desde, p_hasta: c.rango.hasta });
  if (error) throw new Error(error.message);
  const movimientos = (data ?? []) as MovimientoMed[];
  return construirInvMovMed({ tipo: c.filtros.tipo ?? "todos", movimientos, truncado: movimientos.length >= TOPE_MOVIMIENTOS });
}
