import { cantidadTexto } from "@/lib/inventario";
import { col } from "@/lib/reportes/base";
import type { ContextoReporte } from "@/lib/reportes/base";
import { cifra } from "@/lib/reportes/formato";
import { TOPE_MOVIMIENTOS } from "@/lib/reportes/informes/inv-mov-med";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";

export type MovimientoAlimento = { fecha: string; producto_id: string; producto: string; tipo: string; kg: number | null; destino: string | null; detalle: string; quien: string | null };
export type DatosInvMovAlimento = { tipo: string; movimientos: MovimientoAlimento[]; truncado: boolean };

const ETIQUETA: Record<string, string> = { compra: "Compra", salida: "Se dio de comer", ajuste: "Ajuste", apertura: "Conteo de apertura" };
const TONO: Record<string, TonoFila> = { compra: "ok", salida: "musgo", ajuste: "aviso", apertura: "neutro" };
const pasa = (filtro: string, tipo: string) => filtro === "todos" || filtro === tipo || (filtro === "ajuste" && tipo === "apertura");
const kg = (n: number) => `${cantidadTexto(Math.round(n * 10) / 10)} kg`;
const suma = (lista: MovimientoAlimento[], tipo: string) => lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + (m.kg ?? 0), 0);

/** Lo que entró, lo que se dio de comer y lo que se ajustó en el periodo, en kg, con a quién se le dio y quién lo anotó. */
export function construirInvMovAlimento(d: DatosInvMovAlimento): ResultadoReporte {
  const visibles = d.movimientos.filter((m) => pasa(d.tipo, m.tipo));
  const filas: FilaReporte[] = visibles.map((m, i) => ({
    id: `${i}-${m.producto_id}-${m.fecha}-${m.tipo}`,
    titulo: m.producto,
    href: `/inventario/alimento/${m.producto_id}`,
    tono: TONO[m.tipo] ?? "neutro",
    valores: { producto: m.producto, fecha: m.fecha, tipo: ETIQUETA[m.tipo] ?? m.tipo, kg: m.kg, destino: m.destino, detalle: m.detalle, quien: m.quien },
  }));

  const comprado = suma(d.movimientos, "compra");
  const dado = -suma(d.movimientos, "salida");
  const ajustes = suma(d.movimientos, "ajuste");
  // El alimento que más se dio de comer en el periodo.
  const porProducto = new Map<string, number>();
  for (const m of d.movimientos) if (m.tipo === "salida") porProducto.set(m.producto, (porProducto.get(m.producto) ?? 0) - (m.kg ?? 0));
  const mas = [...porProducto.entries()].sort((a, b) => b[1] - a[1])[0];
  const indicadores: Indicador[] = [
    { etiqueta: "Comprado", valor: kg(comprado) },
    { etiqueta: "Se dio de comer", valor: kg(dado), detalle: mas ? `El que más: ${mas[0]} (${kg(mas[1])})` : undefined },
    { etiqueta: "Ajustes", valor: kg(ajustes), detalle: "Conteos, mermas y correcciones" },
    { etiqueta: "Cambio en la bodega", valor: kg(comprado - dado + ajustes), detalle: "Comprado − dado + ajustes (sin contar la apertura)" },
  ];

  const notas: string[] = [];
  const sinSumar = d.movimientos.filter((m) => m.kg === null).length;
  if (sinSumar > 0) notas.push(`${cifra(sinSumar)} ${sinSumar === 1 ? "compra no se pudo sumar" : "compras no se pudieron sumar"} (falta la cantidad o el peso de cada unidad del alimento). Corrígelas para que las existencias cuadren.`);
  if (d.truncado) notas.push(`El periodo tiene más de ${cifra(TOPE_MOVIMIENTOS)} movimientos: se muestran los más recientes. Elige un periodo más corto.`);

  return {
    columnas: [
      col.texto("producto", "Alimento", 28, { soloExcel: true }),
      col.fecha("fecha", "Fecha", 14),
      col.texto("tipo", "Movimiento", 20, { insignia: true }),
      col.decimal("kg", "Kg", 12, 1),
      col.texto("destino", "Para quién", 24),
      col.texto("detalle", "Detalle", 44),
      col.texto("quien", "Lo anotó", 22),
    ],
    filas,
    indicadores,
    notas,
  };
}

export async function informeInvMovAlimento(c: ContextoReporte): Promise<ResultadoReporte> {
  const { data, error } = await c.supabase.rpc("inventario_movimientos_alimento", { p_finca: c.fincaId, p_desde: c.rango.desde, p_hasta: c.rango.hasta });
  if (error) throw new Error(error.message);
  const movimientos = (data ?? []) as MovimientoAlimento[];
  return construirInvMovAlimento({ tipo: c.filtros.tipo ?? "todos", movimientos, truncado: movimientos.length >= TOPE_MOVIMIENTOS });
}
