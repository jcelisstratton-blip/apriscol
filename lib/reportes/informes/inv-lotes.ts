import { diasHasta } from "@/lib/fechas";
import { ETIQUETA_PRODUCTO } from "@/lib/sanidad";
import { DIAS_AVISO_VENCIMIENTO, estadoVencimiento } from "@/lib/inventario";
import { col } from "@/lib/reportes/base";
import type { ContextoReporte } from "@/lib/reportes/base";
import { cifra } from "@/lib/reportes/formato";
import { formatoFecha } from "@/lib/fechas";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";

export type LoteFinca = { producto_id: string; producto: string; tipo: string; unidad: string | null; lote: string | null; vencimiento: string | null; stock: number };
export type DatosInvLotes = { hoy: string; vencimiento: string; lotes: LoteFinca[] };

const SITUACION = { vencido: "Vencido", pronto: "Vence pronto", ok: "Vigente", sin_fecha: "Sin fecha" } as const;
const TONO: Record<keyof typeof SITUACION, TonoFila> = { vencido: "alerta", pronto: "aviso", ok: "ok", sin_fecha: "neutro" };
const RANGO: Record<keyof typeof SITUACION, number> = { vencido: 0, pronto: 1, ok: 2, sin_fecha: 3 };
const estadoDe = (l: LoteFinca, hoy: string): keyof typeof SITUACION => estadoVencimiento(l.vencimiento, hoy) ?? "sin_fecha";

/** Cada lote con existencias, del que vence primero al que vence último. Los lotes sin nada (o en negativo, que son aplicaciones sin lote) no se listan. */
export function construirInvLotes(d: DatosInvLotes): ResultadoReporte {
  const conExistencias = d.lotes.filter((l) => l.stock > 0.004);
  const pasa = (l: LoteFinca) => {
    const e = estadoDe(l, d.hoy);
    return d.vencimiento === "vencido" ? e === "vencido" : d.vencimiento === "por_vencer" ? e === "pronto" : d.vencimiento === "vigente" ? e === "ok" : d.vencimiento === "sin_fecha" ? e === "sin_fecha" : true;
  };

  const filas: FilaReporte[] = conExistencias
    .filter(pasa)
    .sort((a, b) => RANGO[estadoDe(a, d.hoy)] - RANGO[estadoDe(b, d.hoy)] || (a.vencimiento ?? "9999").localeCompare(b.vencimiento ?? "9999") || a.producto.localeCompare(b.producto, "es"))
    .map((l) => {
      const e = estadoDe(l, d.hoy);
      return {
        id: `${l.producto_id}|${l.lote ?? ""}`,
        titulo: `${l.producto} · ${l.lote ?? "Sin lote"}`,
        href: `/inventario/${l.producto_id}`,
        tono: TONO[e],
        valores: {
          producto: l.producto,
          tipo: ETIQUETA_PRODUCTO[l.tipo as keyof typeof ETIQUETA_PRODUCTO] ?? l.tipo,
          lote: l.lote,
          vence: l.vencimiento,
          dias: l.vencimiento ? diasHasta(l.vencimiento, d.hoy) : null,
          existencias: l.stock,
          unidad: l.unidad,
          situacion: SITUACION[e],
        },
      };
    });

  const vencidos = conExistencias.filter((l) => estadoDe(l, d.hoy) === "vencido");
  const porVencer = conExistencias.filter((l) => estadoDe(l, d.hoy) === "pronto");
  const proximo = conExistencias.filter((l) => estadoDe(l, d.hoy) === "pronto" || estadoDe(l, d.hoy) === "ok").sort((a, b) => a.vencimiento!.localeCompare(b.vencimiento!))[0];
  const indicadores: Indicador[] = [
    { etiqueta: "Lotes con existencias", valor: cifra(conExistencias.length) },
    { etiqueta: "Vencidos", valor: cifra(vencidos.length), detalle: "Sácalos de la bodega", alerta: vencidos.length > 0 },
    { etiqueta: `Vencen en ${DIAS_AVISO_VENCIMIENTO} días o menos`, valor: cifra(porVencer.length), alerta: porVencer.length > 0 },
    { etiqueta: "El próximo en vencer", valor: proximo ? formatoFecha(proximo.vencimiento) : "—", detalle: proximo ? `${proximo.producto} · ${proximo.lote ?? "Sin lote"}` : undefined },
  ];

  return {
    columnas: [
      col.texto("producto", "Producto", 28, { soloExcel: true }),
      col.texto("tipo", "Tipo", 20),
      col.texto("lote", "Lote", 16),
      col.fecha("vence", "Vence", 14),
      col.entero("dias", "Días para vencer", 16),
      col.decimal("existencias", "Existencias", 14, 2),
      col.texto("unidad", "Unidad", 10),
      col.texto("situacion", "Situación", 14, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: vencidos.length > 0 ? ["Hay lotes vencidos con existencias. No se deben aplicar: dalos de baja en el inventario con el motivo «Vencido»."] : [],
  };
}

export async function informeInvLotes(c: ContextoReporte): Promise<ResultadoReporte> {
  const { data, error } = await c.supabase.rpc("inventario_lotes_finca", { p_finca: c.fincaId });
  if (error) throw new Error(error.message);
  return construirInvLotes({ hoy: c.hoy, vencimiento: c.filtros.vencimiento ?? "todos", lotes: (data ?? []) as LoteFinca[] });
}
