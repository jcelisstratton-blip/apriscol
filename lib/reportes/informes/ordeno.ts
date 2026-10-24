import { nombreTipo } from "@/lib/animal";
import { diasHasta, sumarDias } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, traerTodo, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { compararArete, diasDesde, promedio, suma } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { LactanciaResumen, ReproHembra } from "@/lib/tipos";

/** Los días hacia atrás que cuenta la producción reciente. */
export const DIAS_PRODUCCION = 30;

export type LactanciaBase = Pick<LactanciaResumen, "animal_id" | "numero" | "fecha_parto" | "fecha_secado" | "dias_lactancia" | "litros_total" | "pico_diario">;
export type ProduccionReciente = { litros_tanque: number; litros_descartados: number; dias: number };

export type DatosOrdeno = {
  hoy: string;
  situacion: string;
  secadoDiasAntes: number;
  /** Las hembras activas que ya especie-filtradas. */
  animales: AnimalBase[];
  lactancias: LactanciaBase[];
  produccion: Map<string, ProduccionReciente>;
  /** Estado reproductivo de cada hembra; `null` si la persona no ve Reproducción. */
  repro: Map<string, ReproHembra> | null;
  truncado: boolean;
};

/** ¿Cuenta como hembra de leche? Si es de leche o doble propósito, o ya tuvo una lactancia (aunque su vocación diga otra cosa). */
export const esDeLeche = (a: Pick<AnimalBase, "vocacion">, tuvoLactancia: boolean) => a.vocacion !== "carne" || tuvoLactancia;

/** Las hembras en ordeño y las secas, con lo que ordeñaron en los últimos 30 días y cuáles ya toca secar. */
export function construirOrdeno(d: DatosOrdeno): ResultadoReporte {
  const ultimaLactancia = new Map<string, LactanciaBase>();
  const conLactancia = new Set<string>();
  for (const l of d.lactancias) {
    if (!l.animal_id) continue;
    conLactancia.add(l.animal_id);
    const previa = ultimaLactancia.get(l.animal_id);
    if (!previa || (l.fecha_parto ?? "") > (previa.fecha_parto ?? "")) ultimaLactancia.set(l.animal_id, l);
  }

  const hembras = d.animales
    .filter((a) => a.sexo === "hembra" && esDeLeche(a, conLactancia.has(a.id)))
    .map((a) => {
      const lac = ultimaLactancia.get(a.id);
      const enOrdeno = Boolean(lac && !lac.fecha_secado);
      const r = d.repro?.get(a.id);
      const porSecar = enOrdeno && r?.estado === "gestante" && Boolean(r.fecha_prevista_parto) && diasHasta(r.fecha_prevista_parto!, d.hoy) <= d.secadoDiasAntes;
      const p = d.produccion.get(a.id);
      const total = p ? Number(p.litros_tanque) + Number(p.litros_descartados) : 0;
      return { a, lac, enOrdeno, r, porSecar, p, total, diario: p && p.dias > 0 ? total / p.dias : null };
    });

  const pasa = (x: (typeof hembras)[number]) => (d.situacion === "ordeno" ? x.enOrdeno : d.situacion === "seca" ? !x.enOrdeno : d.situacion === "por_secar" ? x.porSecar : true);
  const visibles = hembras.filter(pasa).sort((x, y) => Number(y.enOrdeno) - Number(x.enOrdeno) || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const tono: TonoFila = x.porSecar ? "aviso" : x.enOrdeno ? "ok" : "neutro";
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: hrefAnimal(x.a.id),
      tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        situacion: x.porSecar ? "Por secar" : x.enOrdeno ? "En ordeño" : "Seca",
        lactancia: x.lac?.numero ?? null,
        parto: x.lac?.fecha_parto ?? null,
        dias_en_leche: x.enOrdeno ? (x.lac?.dias_lactancia ?? null) : null,
        secada: x.enOrdeno ? null : (x.lac?.fecha_secado ?? null),
        dias_secas: !x.enOrdeno && x.lac?.fecha_secado ? diasDesde(x.lac.fecha_secado, d.hoy) : null,
        litros: x.p ? x.total : null,
        descartados: x.p ? Number(x.p.litros_descartados) : null,
        promedio: x.diario,
        pico: x.lac?.pico_diario ?? null,
        total_lactancia: x.lac?.litros_total ?? null,
        ...(d.repro ? { estado_repro: x.r ? ETIQUETA_ESTADO[x.r.estado] : null, parto_previsto: x.r?.estado === "gestante" ? x.r.fecha_prevista_parto : null } : {}),
      },
    };
  });

  const enOrdeno = hembras.filter((x) => x.enOrdeno);
  const porSecar = hembras.filter((x) => x.porSecar).length;
  const indicadores: Indicador[] = [
    { etiqueta: "En ordeño", valor: cifra(enOrdeno.length) },
    { etiqueta: "Secas", valor: cifra(hembras.length - enOrdeno.length) },
  ];
  if (d.repro) indicadores.push({ etiqueta: "Por secar", valor: cifra(porSecar), alerta: porSecar > 0 });
  const diarioMedio = promedio(enOrdeno.flatMap((x) => (x.diario === null ? [] : [x.diario])));
  indicadores.push(
    { etiqueta: `Litros (${DIAS_PRODUCCION} días)`, valor: cifra(suma(hembras.map((x) => x.total)), 1) },
    { etiqueta: "Promedio diario por hembra en ordeño", valor: diarioMedio === null ? "—" : `${cifra(diarioMedio, 1)} L` },
    { etiqueta: "Litros descartados", valor: cifra(suma(hembras.map((x) => (x.p ? Number(x.p.litros_descartados) : 0))), 1) },
  );

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.texto("situacion", "Situación", 14, { insignia: true }),
      col.entero("lactancia", "Lactancia n.º", 12),
      col.fecha("parto", "Fecha de parto"),
      col.entero("dias_en_leche", "Días en leche", 12),
      col.fecha("secada", "Secada el"),
      col.entero("dias_secas", "Días secas", 11),
      col.decimal("litros", `Litros (${DIAS_PRODUCCION} días)`, 14),
      col.decimal("descartados", "Descartados (L)", 14),
      col.decimal("promedio", "Promedio diario (L)", 14),
      col.decimal("pico", "Pico de la lactancia (L)", 14),
      col.decimal("total_lactancia", "Total de la lactancia (L)", 16),
      ...(d.repro ? [col.texto("estado_repro", "Estado reproductivo", 18), col.fecha("parto_previsto", "Parto previsto")] : []),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeOrdeno(c: ContextoReporte): Promise<ResultadoReporte> {
  const desde = sumarDias(c.hoy, -(DIAS_PRODUCCION - 1));
  const [animales, lactancias, produccion, repro] = await Promise.all([
    cargarAnimales(c),
    traerTodo<LactanciaBase>((d, h) =>
      c.supabase.from("v_lactancias_resumen").select("animal_id, numero, fecha_parto, fecha_secado, dias_lactancia, litros_total, pico_diario").eq("finca_id", c.fincaId).order("lactancia_id").range(d, h),
    ),
    c.supabase.rpc("produccion_por_animal", { p_finca: c.fincaId, p_desde: desde, p_hasta: c.hoy }),
    c.puede("reproduccion")
      ? traerTodo<ReproHembra>((d, h) => c.supabase.from("v_repro_hembras").select("*").eq("finca_id", c.fincaId).order("animal_id").range(d, h))
      : Promise.resolve(null),
  ]);
  if (produccion.error) throw new Error(produccion.error.message);
  return construirOrdeno({
    hoy: c.hoy,
    situacion: c.filtros.situacion ?? "todos",
    secadoDiasAntes: c.ajustes.general.secado_dias_antes_parto,
    animales: animales.lista.filter((a) => a.estado === "activo" && pasaEspecie(c, a.especie)),
    lactancias: lactancias.filas,
    produccion: new Map((produccion.data ?? []).map((p) => [p.animal_id, p])),
    repro: repro ? new Map(repro.filas.map((r) => [r.animal_id, r])) : null,
    truncado: animales.truncado || lactancias.truncado,
  });
}
