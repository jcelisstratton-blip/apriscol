import { diasHasta } from "@/lib/fechas";
import { ETIQUETA_PRODUCTO } from "@/lib/sanidad";
import { ETIQUETA_ESTADO_STOCK, enPresentaciones, estadoStock, estadoVencimiento, faltaParaMinimo, pideAtencion, type EstadoStock, type FilaInventario } from "@/lib/inventario";
import { col } from "@/lib/reportes/base";
import type { ContextoReporte } from "@/lib/reportes/base";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";

export type DatosInvMedicamentos = { hoy: string; estado: string; productos: FilaInventario[] };

/** Qué dice la insignia de un producto: un lote vencido manda sobre el stock; después, lo más grave primero. */
function situacion(f: FilaInventario, hoy: string): { texto: string; tono: TonoFila; rango: number } {
  const estado: EstadoStock = estadoStock(f);
  const venc = estadoVencimiento(f.vence_pronto, hoy);
  if (venc === "vencido") return { texto: "Lote vencido", tono: "alerta", rango: 0 };
  if (estado === "negativo") return { texto: ETIQUETA_ESTADO_STOCK.negativo, tono: "alerta", rango: 1 };
  if (estado === "agotado") return { texto: ETIQUETA_ESTADO_STOCK.agotado, tono: "alerta", rango: 2 };
  if (estado === "bajo") return { texto: ETIQUETA_ESTADO_STOCK.bajo, tono: "aviso", rango: 3 };
  if (venc === "pronto") return { texto: "Lote por vencer", tono: "aviso", rango: 4 };
  if (estado === "sin_contar") return { texto: ETIQUETA_ESTADO_STOCK.sin_contar, tono: "neutro", rango: 6 };
  return { texto: ETIQUETA_ESTADO_STOCK.ok, tono: "ok", rango: 5 };
}

/** Cada medicamento y vacuna con lo que queda, su mínimo, el vencimiento más cercano y lo que impide que la cuenta cuadre. Lo más grave, primero. */
export function construirInvMedicamentos(d: DatosInvMedicamentos): ResultadoReporte {
  const todos = d.productos.map((f) => ({ f, s: situacion(f, d.hoy), contado: estadoStock(f) !== "sin_contar", atencion: pideAtencion(f, d.hoy) }));
  const pasa = (x: (typeof todos)[number]) => (d.estado === "atencion" ? x.contado && x.atencion : d.estado === "por_contar" ? !x.contado : d.estado === "al_dia" ? x.contado && !x.atencion : true);

  const filas: FilaReporte[] = todos
    .filter(pasa)
    .sort((a, b) => a.s.rango - b.s.rango || a.f.nombre.localeCompare(b.f.nombre, "es"))
    .map(({ f, s }) => ({
      id: f.producto_id,
      titulo: f.nombre,
      href: `/inventario/${f.producto_id}`,
      tono: s.tono,
      valores: {
        tipo: ETIQUETA_PRODUCTO[f.tipo as keyof typeof ETIQUETA_PRODUCTO] ?? f.tipo,
        situacion: s.texto,
        existencias: f.stock,
        unidad: f.unidad,
        presentaciones: f.stock !== null ? enPresentaciones(f.stock, f.contenido_presentacion) : null,
        presentacion: f.contenido_presentacion ? f.presentacion : null,
        minimo: f.stock_minimo,
        falta: faltaParaMinimo(f),
        vence: f.stock !== null && f.stock > 0 ? f.vence_pronto : null,
        dias_vence: f.stock !== null && f.stock > 0 && f.vence_pronto ? diasHasta(f.vence_pronto, d.hoy) : null,
        desde: f.desde,
        compras_sin_calcular: f.compras_sin_calcular || null,
        aplicaciones_sin_dosis: f.aplicaciones_sin_dosis || null,
      },
    }));

  const conVencimiento = todos.filter((x) => ["vencido", "pronto"].includes(estadoVencimiento(x.f.vence_pronto, d.hoy) ?? "")).length;
  const atencion = todos.filter((x) => x.contado && x.atencion).length;
  const indicadores: Indicador[] = [
    { etiqueta: "Productos", valor: cifra(todos.length) },
    { etiqueta: "Piden atención", valor: cifra(atencion), alerta: atencion > 0 },
    { etiqueta: "Con lote vencido o por vencer", valor: cifra(conVencimiento), alerta: conVencimiento > 0 },
    { etiqueta: "Por contar", valor: cifra(todos.filter((x) => !x.contado).length), detalle: "Sin conteo de apertura" },
  ];

  const notas: string[] = [];
  const sinCalcular = todos.filter((x) => x.f.compras_sin_calcular > 0).length;
  const sinDosis = todos.filter((x) => x.f.aplicaciones_sin_dosis > 0).length;
  if (sinCalcular > 0) notas.push(`${cifra(sinCalcular)} ${sinCalcular === 1 ? "producto tiene" : "productos tienen"} compras que no se pudieron sumar (falta la cantidad o definir cómo viene el producto): sus existencias están por debajo de lo real.`);
  if (sinDosis > 0) notas.push(`${cifra(sinDosis)} ${sinDosis === 1 ? "producto tiene" : "productos tienen"} aplicaciones sin dosis, que no descuentan: sus existencias están por encima de lo real.`);

  return {
    columnas: [
      col.texto("tipo", "Tipo", 20),
      col.texto("situacion", "Situación", 16, { insignia: true }),
      col.decimal("existencias", "Existencias", 14, 2),
      col.texto("unidad", "Unidad", 10),
      col.decimal("presentaciones", "En presentaciones", 16, 2),
      col.texto("presentacion", "Presentación", 14),
      col.decimal("minimo", "Mínimo", 12, 2),
      col.decimal("falta", "Falta para el mínimo", 18, 2),
      col.fecha("vence", "Vence el lote más próximo", 22),
      col.entero("dias_vence", "Días para vencer", 14),
      col.fecha("desde", "Se cuenta desde", 16),
      col.entero("compras_sin_calcular", "Compras sin sumar", 16),
      col.entero("aplicaciones_sin_dosis", "Aplicaciones sin dosis", 20),
    ],
    filas,
    indicadores,
    notas,
  };
}

export async function informeInvMedicamentos(c: ContextoReporte): Promise<ResultadoReporte> {
  const { data, error } = await c.supabase.rpc("inventario_productos", { p_finca: c.fincaId });
  if (error) throw new Error(error.message);
  return construirInvMedicamentos({ hoy: c.hoy, estado: c.filtros.estado ?? "todos", productos: (data ?? []) as FilaInventario[] });
}
