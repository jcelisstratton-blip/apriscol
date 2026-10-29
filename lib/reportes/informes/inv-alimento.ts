import { cantidadTexto } from "@/lib/inventario";
import {
  ETIQUETA_ESTADO_ALIMENTO,
  alimentoPideAtencion,
  autonomiaDias,
  compraEnKg,
  consumoDiarioKg,
  estadoAlimento,
  type EstadoAlimento,
  type FilaAlimento,
} from "@/lib/inventario-alimento";
import { col } from "@/lib/reportes/base";
import type { ContextoReporte } from "@/lib/reportes/base";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";

export type DatosInvAlimento = { hoy: string; estado: string; plazoDias: number; alimentos: FilaAlimento[] };

const RUBRO: Record<string, string> = { concentrado: "Concentrado", forraje: "Forraje", sales_suplementos: "Sales y suplementos", leche_maternizada: "Leche maternizada" };
const TONO: Record<EstadoAlimento, TonoFila> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", critico: "alerta", bajo: "aviso", ok: "ok", sin_datos: "neutro" };
/** De lo más urgente a lo menos. */
const RANGO: Record<EstadoAlimento, number> = { negativo: 0, agotado: 1, critico: 2, bajo: 3, sin_datos: 4, ok: 5, sin_contar: 6 };

/** Cada alimento con lo que queda en kg, lo que se da por día y para cuántos días alcanza. Lo que se acaba primero, arriba. */
export function construirInvAlimento(d: DatosInvAlimento): ResultadoReporte {
  const todos = d.alimentos.map((f) => ({ f, e: estadoAlimento(f, d.plazoDias, d.hoy), dias: autonomiaDias(f, d.hoy), diario: consumoDiarioKg(f, d.hoy) }));
  const contado = (x: (typeof todos)[number]) => x.e !== "sin_contar";
  const atencion = (x: (typeof todos)[number]) => alimentoPideAtencion(x.f, d.plazoDias, d.hoy);
  const pasa = (x: (typeof todos)[number]) => (d.estado === "atencion" ? contado(x) && atencion(x) : d.estado === "por_contar" ? !contado(x) : d.estado === "al_dia" ? contado(x) && !atencion(x) : true);

  const filas: FilaReporte[] = todos
    .filter(pasa)
    .sort((a, b) => RANGO[a.e] - RANGO[b.e] || (a.dias ?? Infinity) - (b.dias ?? Infinity) || a.f.nombre.localeCompare(b.f.nombre, "es"))
    .map(({ f, e, dias, diario }) => ({
      id: f.producto_id,
      titulo: f.nombre,
      href: `/inventario/alimento/${f.producto_id}`,
      tono: TONO[e],
      valores: {
        tipo: RUBRO[f.rubro] ?? f.rubro,
        situacion: ETIQUETA_ESTADO_ALIMENTO[e],
        existencias_kg: f.stock_kg,
        en_unidades: f.stock_kg !== null && f.kg_por_unidad && !compraEnKg(f.unidad) ? Math.round((f.stock_kg / f.kg_por_unidad) * 100) / 100 : null,
        unidad: f.kg_por_unidad && !compraEnKg(f.unidad) ? f.unidad : null,
        consumo_dia_kg: diario === null ? null : Math.round(diario * 10) / 10,
        autonomia_dias: dias === null ? null : Math.round(dias * 10) / 10,
        consumo_14d_kg: f.desde ? f.consumo_kg : null,
        dias_con_salida: f.desde ? f.dias_con_salida : null,
        desde: f.desde,
        compras_sin_calcular: f.compras_sin_calcular || null,
      },
    }));

  const consumoTotal = todos.reduce((s, x) => s + (x.diario ?? 0), 0);
  const nAtencion = todos.filter((x) => contado(x) && atencion(x)).length;
  const indicadores: Indicador[] = [
    { etiqueta: "Alimentos", valor: cifra(todos.length) },
    { etiqueta: "Piden atención", valor: cifra(nAtencion), alerta: nAtencion > 0 },
    { etiqueta: "Por contar", valor: cifra(todos.filter((x) => !contado(x)).length), detalle: "Sin conteo de apertura" },
    { etiqueta: "Se da por día", valor: `${cantidadTexto(Math.round(consumoTotal * 10) / 10)} kg`, detalle: "Suma de los alimentos con consumo calculado" },
  ];

  const notas: string[] = [];
  const sinCalcular = todos.filter((x) => x.f.compras_sin_calcular > 0).length;
  if (sinCalcular > 0) notas.push(`${cifra(sinCalcular)} ${sinCalcular === 1 ? "alimento tiene" : "alimentos tienen"} compras que no se pudieron sumar (falta la cantidad o el peso de cada unidad): sus existencias están por debajo de lo real.`);
  return {
    columnas: [
      col.texto("tipo", "Tipo", 20),
      col.texto("situacion", "Situación", 22, { insignia: true }),
      col.decimal("existencias_kg", "Existencias (kg)", 16, 1),
      col.decimal("en_unidades", "En unidades de compra", 20, 1),
      col.texto("unidad", "Unidad de compra", 16),
      col.decimal("consumo_dia_kg", "Se da por día (kg)", 18, 1),
      col.decimal("autonomia_dias", "Alcanza (días)", 16, 1),
      col.decimal("consumo_14d_kg", "Dado en 14 días (kg)", 20, 1),
      col.entero("dias_con_salida", "Días con salidas", 16),
      col.fecha("desde", "Se cuenta desde", 16),
      col.entero("compras_sin_calcular", "Compras sin sumar", 16),
    ],
    filas,
    indicadores,
    notas,
  };
}

export async function informeInvAlimento(c: ContextoReporte): Promise<ResultadoReporte> {
  const { data, error } = await c.supabase.rpc("inventario_alimento", { p_finca: c.fincaId, p_hoy: c.hoy });
  if (error) throw new Error(error.message);
  return construirInvAlimento({ hoy: c.hoy, estado: c.filtros.estado ?? "todos", plazoDias: c.ajustes.general.stock_autonomia_dias, alimentos: (data ?? []) as FilaAlimento[] });
}
