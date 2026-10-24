import { nombreTipo } from "@/lib/animal";
import { diasHasta } from "@/lib/fechas";
import { ETIQUETA_EVENTO } from "@/lib/sanidad";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import { enTramos } from "@/lib/consultas";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { compararArete } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { EventoDeAnimal } from "@/lib/tipos";

export type RetiroAnimal = { animal_id: string; retiro_leche_hasta: string | null; retiro_carne_hasta: string | null };
export type EventoRetiro = { animal_id: string } & Pick<EventoDeAnimal, "fecha" | "tipo" | "producto_nombre" | "diagnostico" | "fin_retiro_leche" | "fin_retiro_carne">;

export type DatosRetiro = {
  hoy: string;
  tipo: string;
  retiros: RetiroAnimal[];
  eventos: EventoRetiro[];
  animales: Map<string, AnimalBase>;
  especie: (a: AnimalBase) => boolean;
  truncado: boolean;
};

/** El último día del retiro que sigue vigente (hoy o después), o `null` si ya terminó o no hay. */
const vigente = (hasta: string | null, hoy: string) => (hasta && hasta >= hoy ? hasta : null);

/** Los animales cuya leche o carne aún no se puede usar, hasta cuándo, y qué tratamiento causó el retiro. */
export function construirRetiro(d: DatosRetiro): ResultadoReporte {
  // El tratamiento que más alarga el retiro de cada animal (el que mantiene vigente su fecha).
  const causa = new Map<string, EventoRetiro>();
  const fin = (e: EventoRetiro) => [e.fin_retiro_leche, e.fin_retiro_carne].filter((x): x is string => Boolean(x) && x! >= d.hoy).sort().pop() ?? "";
  for (const e of d.eventos) {
    const previo = causa.get(e.animal_id);
    if (fin(e) && (!previo || fin(e) > fin(previo))) causa.set(e.animal_id, e);
  }

  const todos = d.retiros
    .map((r) => ({ r, a: d.animales.get(r.animal_id), leche: vigente(r.retiro_leche_hasta, d.hoy), carne: vigente(r.retiro_carne_hasta, d.hoy) }))
    .filter((x): x is typeof x & { a: AnimalBase } => Boolean(x.a) && d.especie(x.a!) && Boolean(x.leche || x.carne));

  const visibles = todos
    .filter((x) => (d.tipo === "leche" ? x.leche : d.tipo === "carne" ? x.carne : true))
    .sort((x, y) => (x.leche ?? x.carne ?? "").localeCompare(y.leche ?? y.carne ?? "") || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const e = causa.get(x.a.id);
    const tono: TonoFila = x.leche && x.carne ? "alerta" : "aviso";
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: hrefAnimal(x.a.id, "#sanidad"),
      tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        leche_hasta: x.leche,
        leche_dias: x.leche ? diasHasta(x.leche, d.hoy) : null,
        carne_hasta: x.carne,
        carne_dias: x.carne ? diasHasta(x.carne, d.hoy) : null,
        tratamiento: e ? (e.producto_nombre?.trim() || (e.tipo ? ETIQUETA_EVENTO[e.tipo] : null)) : null,
        fecha_tratamiento: e?.fecha ?? null,
        diagnostico: e?.diagnostico ?? null,
        situacion: x.leche && x.carne ? "Leche y carne" : x.leche ? "Solo la leche" : "Solo la carne",
      },
    };
  });

  // Cuándo queda libre el animal del todo: cuando termina el más largo de sus retiros.
  const libre = (x: (typeof todos)[number]) => [x.leche, x.carne].filter((f): f is string => Boolean(f)).sort().pop()!;
  const indicadores: Indicador[] = [
    { etiqueta: "Animales en retiro", valor: cifra(todos.length) },
    { etiqueta: "Leche retenida", valor: cifra(todos.filter((x) => x.leche).length) },
    { etiqueta: "Carne retenida", valor: cifra(todos.filter((x) => x.carne).length) },
    { etiqueta: "Quedan libres en 7 días", valor: cifra(todos.filter((x) => diasHasta(libre(x), d.hoy) <= 7).length) },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.fecha("leche_hasta", "Leche, hasta"),
      col.entero("leche_dias", "Días de leche", 12),
      col.fecha("carne_hasta", "Carne, hasta"),
      col.entero("carne_dias", "Días de carne", 12),
      col.texto("tratamiento", "Tratamiento", 24),
      col.fecha("fecha_tratamiento", "Fecha del tratamiento"),
      col.texto("diagnostico", "Diagnóstico", 24),
      col.texto("situacion", "En retiro", 16, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeRetiro(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, retiros] = await Promise.all([cargarAnimales(c), c.supabase.rpc("animales_en_retiro", { p_finca: c.fincaId })]);
  if (retiros.error) throw new Error(retiros.error.message);
  const lista = retiros.data ?? [];

  const respuestas = await Promise.all(
    enTramos(lista.map((r) => r.animal_id)).map((t) =>
      c.supabase
        .from("v_eventos_animal")
        .select("animal_id, fecha, tipo, producto_nombre, diagnostico, fin_retiro_leche, fin_retiro_carne")
        .eq("finca_id", c.fincaId)
        .in("animal_id", t)
        .or(`fin_retiro_leche.gte.${c.hoy},fin_retiro_carne.gte.${c.hoy}`),
    ),
  );
  return construirRetiro({
    hoy: c.hoy,
    tipo: c.filtros.tipo ?? "todos",
    retiros: lista,
    eventos: respuestas.flatMap((r) => (r.data ?? []).flatMap((e) => (e.animal_id ? [{ ...e, animal_id: e.animal_id }] : []))),
    animales: animales.porId,
    especie: (a) => pasaEspecie(c, a.especie),
    truncado: animales.truncado,
  });
}
