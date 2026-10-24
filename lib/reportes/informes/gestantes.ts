import { nombreTipo } from "@/lib/animal";
import { diasHasta } from "@/lib/fechas";
import { DIAS_PARTO_ATRASADO, plazoParto } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, col, enTramos, hrefAnimal, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { DIAS_PARTO_PROXIMO, ETIQUETA_ETAPA, avanceGestacion, compararArete, etapaGestacion, suma } from "@/lib/reportes/calculos";
import type { Etapa } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import { cargarReproBase, cargarServicios, reproductorDe, tipoServicio } from "@/lib/reportes/informes/repro-comun";
import type { DiagnosticoBase, ServicioBase } from "@/lib/reportes/informes/repro-comun";
import type { FilaReporte, Indicador, ResultadoReporte } from "@/lib/reportes/tipos";
import type { ReproHembra } from "@/lib/tipos";

export type DatosGestantes = {
  hoy: string;
  ventana: string;
  ultimoTercioDia: number;
  secadoDiasAntes: number;
  repro: ReproHembra[];
  animales: Map<string, AnimalBase>;
  servicios: Map<string, ServicioBase>;
  /** Cuántos fetos contó la ecografía de cada servicio (el más reciente que confirmó la gestación). */
  fetos: Map<string, number>;
  truncado: boolean;
};

type Fila = { r: ReproHembra; a: AnimalBase; dias: number; etapa: Etapa; fetos: number | null; porSecar: boolean };

/** Las hembras con la gestación confirmada: cuándo paren, en qué parte van, cuántas crías se esperan y a quiénes ya toca secar. */
export function construirGestantes(d: DatosGestantes): ResultadoReporte {
  const gestantes: Fila[] = d.repro
    .filter((r) => r.estado === "gestante" && r.fecha_prevista_parto)
    .flatMap((r): Fila[] => {
      const a = d.animales.get(r.animal_id);
      if (!a || a.estado !== "activo") return [];
      const dias = diasHasta(r.fecha_prevista_parto!, d.hoy);
      const { gestados, total } = r.ultimo_servicio ? avanceGestacion(r.ultimo_servicio, r.fecha_prevista_parto!, d.hoy) : { gestados: 0, total: 150 };
      return [
        {
          r,
          a,
          dias,
          etapa: etapaGestacion(gestados, total, d.ultimoTercioDia),
          fetos: r.servicio_id ? (d.fetos.get(r.servicio_id) ?? null) : null,
          porSecar: r.en_lactancia && dias <= d.secadoDiasAntes,
        },
      ];
    });

  const pasa = (x: Fila) =>
    d.ventana === "proximos" ? x.dias >= -DIAS_PARTO_ATRASADO && x.dias <= DIAS_PARTO_PROXIMO
    : d.ventana === "atrasadas" ? x.dias < -DIAS_PARTO_ATRASADO
    : d.ventana === "ultimo_tercio" ? x.etapa === "ultimo_tercio" && x.dias >= 0
    : d.ventana === "por_secar" ? x.porSecar
    : true;
  const visibles = gestantes.filter(pasa).sort((x, y) => x.dias - y.dias || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const s = x.r.servicio_id ? d.servicios.get(x.r.servicio_id) : undefined;
    const plazo = plazoParto(x.r.fecha_prevista_parto!, d.hoy);
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: hrefAnimal(x.a.id, "#reproduccion"),
      tono: plazo.tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        servicio: x.r.ultimo_servicio,
        tipo_servicio: tipoServicio(s),
        reproductor: reproductorDe(s, d.animales),
        fetos: x.fetos,
        prevista: x.r.fecha_prevista_parto,
        dias: x.dias,
        etapa: ETIQUETA_ETAPA[x.etapa],
        lactancia: x.r.en_lactancia ? "Sí" : "No",
        nota: x.porSecar ? "Por secar" : null,
        plazo: plazo.texto,
      },
    };
  });

  const entre = (desde: number, hasta: number) => cifra(gestantes.filter((x) => x.dias >= desde && x.dias <= hasta).length);
  const atrasadas = gestantes.filter((x) => x.dias < -DIAS_PARTO_ATRASADO).length;
  const indicadores: Indicador[] = [
    { etiqueta: "Gestantes", valor: cifra(gestantes.length) },
    { etiqueta: "Crías esperadas (mínimo)", valor: cifra(suma(gestantes.map((x) => x.fetos ?? 1))), detalle: "Sin ecografía se cuenta una cría por hembra" },
    { etiqueta: "Paren en 30 días", valor: entre(-DIAS_PARTO_ATRASADO, 30) },
    { etiqueta: "Entre 31 y 60 días", valor: entre(31, 60) },
    { etiqueta: "Atrasadas", valor: cifra(atrasadas), alerta: atrasadas > 0 },
    { etiqueta: "En último tercio", valor: cifra(gestantes.filter((x) => x.etapa === "ultimo_tercio" && x.dias >= 0).length) },
    { etiqueta: "Por secar", valor: cifra(gestantes.filter((x) => x.porSecar).length) },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.fecha("servicio", "Servicio"),
      col.texto("tipo_servicio", "Tipo de servicio", 20),
      col.texto("reproductor", "Reproductor", 22),
      col.entero("fetos", "Fetos (ecografía)", 14),
      col.fecha("prevista", "Parto previsto"),
      col.entero("dias", "Días para el parto", 14),
      col.texto("etapa", "Etapa", 16),
      col.texto("lactancia", "En lactancia", 12),
      col.texto("nota", "Nota", 12),
      col.texto("plazo", "Plazo", 24, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeGestantes(c: ContextoReporte): Promise<ResultadoReporte> {
  const base = await cargarReproBase(c);
  const gestantes = base.repro.filter((r) => r.estado === "gestante" && r.servicio_id);
  const ids = gestantes.map((r) => r.servicio_id!);
  const servicios = await cargarServicios(c, ids);

  // El diagnóstico que confirmó la gestación de cada servicio; si hubo varios, el más reciente.
  const respuestas = await Promise.all(
    enTramos([...new Set(ids)]).map((t) =>
      c.supabase.from("diagnosticos_gestacion").select("id, hembra_id, servicio_id, fecha, resultado, num_fetos").eq("finca_id", c.fincaId).eq("resultado", "gestante").in("servicio_id", t),
    ),
  );
  const fetos = new Map<string, number>();
  const fechas = new Map<string, string>();
  for (const dx of respuestas.flatMap((r) => (r.data ?? []) as DiagnosticoBase[])) {
    if (!dx.servicio_id || dx.num_fetos === null) continue;
    if (!fechas.has(dx.servicio_id) || dx.fecha > fechas.get(dx.servicio_id)!) {
      fechas.set(dx.servicio_id, dx.fecha);
      fetos.set(dx.servicio_id, dx.num_fetos);
    }
  }

  return construirGestantes({
    hoy: c.hoy,
    ventana: c.filtros.ventana ?? "todos",
    ultimoTercioDia: c.ajustes.general.ultimo_tercio_dia,
    secadoDiasAntes: c.ajustes.general.secado_dias_antes_parto,
    repro: base.repro,
    animales: base.animales,
    servicios,
    fetos,
    truncado: base.truncado,
  });
}
