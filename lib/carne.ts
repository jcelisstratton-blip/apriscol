import type { FilaLote } from "@/components/ListaLotes";
import type { CebaLote, LoteCeba, TipoPesaje } from "@/lib/tipos";

export const TIPOS_PESAJE: TipoPesaje[] = ["control", "destete", "pre_beneficio"];
export const ETIQUETA_PESAJE: Record<TipoPesaje, string> = {
  control: "Control",
  destete: "Destete",
  pre_beneficio: "Antes del beneficio",
};

/** Kilos con un decimal y coma: «23,5 kg». */
export const kg = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`);

/** Ganancia diaria de peso en gramos por día: «162 g/día». */
export const gdp = (g: number | null | undefined) => (g == null ? "—" : `${Math.round(g).toLocaleString("es-CO")} g/día`);

/**
 * Conversión alimenticia: kilos de alimento por cada kilo ganado. Menos es mejor. Sin ganancia medida no hay conversión (null):
 * dividir entre cero o entre una ganancia negativa no dice nada.
 */
export function conversion(kgAlimento: number, kgGanados: number): number | null {
  if (!(kgGanados > 0) || !(kgAlimento > 0)) return null;
  return kgAlimento / kgGanados;
}

export const textoConversion = (c: number | null) => (c == null ? "—" : `${c.toLocaleString("es-CO", { maximumFractionDigits: 1 })} : 1`);

/** Cuánto le falta a un animal para la meta del lote (0 si ya la alcanzó). */
export const faltaParaMeta = (peso: number | null | undefined, meta: number | null | undefined): number | null =>
  peso == null || meta == null ? null : Math.max(0, Math.round((meta - peso) * 10) / 10);

/** Avance hacia la meta, de 0 a 100. */
export const avanceMeta = (peso: number | null | undefined, meta: number | null | undefined): number | null =>
  peso == null || meta == null || meta <= 0 ? null : Math.min(100, Math.round((peso / meta) * 100));


/** Junta cada lote con lo que lleva (`ceba_lotes`). Un lote sin animales aparece con ceros. */
export function filasLotes(lotes: LoteCeba[], estadisticas: CebaLote[]): FilaLote[] {
  const porId = new Map(estadisticas.map((e) => [e.lote_id, e]));
  return lotes.map((l) => {
    const e = porId.get(l.id);
    return {
      id: l.id,
      nombre: l.nombre,
      fechaInicio: l.fecha_inicio,
      cerradoEn: l.cerrado_en,
      pesoMeta: l.peso_meta_kg,
      animales: e?.animales ?? 0,
      pesoPromedio: e?.peso_promedio ?? null,
      gdpG: e?.gdp_g ?? null,
      kgGanados: Number(e?.kg_ganados ?? 0),
      kgAlimento: Number(e?.kg_alimento ?? 0),
      listos: e?.listos ?? 0,
    };
  });
}
