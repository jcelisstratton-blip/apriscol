import { nombreTipo } from "@/lib/animal";
import { DIAS_REPETIR_DX_DESDE, DIAS_REPETIR_DX_HASTA, ETIQUETA_RESULTADO, seguimientoServida, type SeguimientoServida, type VentanaDx } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, col, hrefAnimal, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { compararArete } from "@/lib/reportes/calculos";
import { diasDesde } from "@/lib/fechas";
import { cifra } from "@/lib/reportes/formato";
import { cargarReproBase, cargarServicios, reproductorDe, tipoServicio } from "@/lib/reportes/informes/repro-comun";
import type { ServicioBase } from "@/lib/reportes/informes/repro-comun";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { ReproHembra } from "@/lib/tipos";

export type DatosPorPalpar = {
  hoy: string;
  momento: string;
  /** Desde y hasta qué día después del servicio se diagnostica, según los Ajustes de la finca. */
  ventana: VentanaDx;
  repro: ReproHembra[];
  animales: Map<string, AnimalBase>;
  servicios: Map<string, ServicioBase>;
  truncado: boolean;
};

type Fila = { r: ReproHembra; a: AnimalBase; s: SeguimientoServida; texto: string; tono: TonoFila };

const GRAVEDAD = { atrasado: 0, toca: 1, pronto: 2 } as const;
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** La frase de la situación de una servida y su color, a partir del seguimiento que calcula `lib/reproduccion.ts`. */
function textoSeguimiento(s: SeguimientoServida, ventana: VentanaDx): { texto: string; tono: TonoFila } {
  const [desde, hasta] = s.clase === "repetir" ? [DIAS_REPETIR_DX_DESDE, DIAS_REPETIR_DX_HASTA] : [ventana.desde, ventana.hasta];
  if (s.estado === "pronto") return { texto: s.clase === "repetir" ? `Repetir en ${dias(desde - s.dias)}` : `Faltan ${dias(desde - s.dias)}`, tono: "neutro" };
  if (s.estado === "toca") return { texto: s.clase === "repetir" ? "Toca repetir el diagnóstico" : "Toca diagnosticar", tono: "aviso" };
  return { texto: s.clase === "repetir" ? `Repetición atrasada ${dias(s.dias - hasta)}` : `Diagnóstico atrasado ${dias(s.dias - hasta)}`, tono: "alerta" };
}

/** Las hembras servidas que aún no tienen un diagnóstico de gestación que las confirme o las descarte, y qué toca hacer con cada una. */
export function construirPorPalpar(d: DatosPorPalpar): ResultadoReporte {
  const servidas: Fila[] = d.repro.flatMap((r): Fila[] => {
    const a = d.animales.get(r.animal_id);
    const s = a && a.estado === "activo" ? seguimientoServida(r, d.hoy, d.ventana) : null;
    return a && s ? [{ r, a, s, ...textoSeguimiento(s, d.ventana) }] : [];
  });

  const pasa = (x: Fila) => (d.momento === "toca" ? x.s.estado !== "pronto" : d.momento === "pronto" ? x.s.estado === "pronto" : d.momento === "repetir" ? x.s.clase === "repetir" : true);
  const visibles = servidas.filter(pasa).sort((x, y) => GRAVEDAD[x.s.estado] - GRAVEDAD[y.s.estado] || y.s.dias - x.s.dias || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const sv = x.r.servicio_id ? d.servicios.get(x.r.servicio_id) : undefined;
    const repetir = x.s.clase === "repetir";
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: repetir ? `/hato/${x.a.id}/reproduccion/diagnostico/nuevo` : hrefAnimal(x.a.id, "#reproduccion"),
      tono: x.tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        servicio: x.r.ultimo_servicio,
        tipo_servicio: tipoServicio(sv),
        reproductor: reproductorDe(sv, d.animales),
        dias_servicio: diasDesde(x.r.ultimo_servicio!, d.hoy),
        diagnostico_previo: repetir && x.r.diagnostico ? ETIQUETA_RESULTADO[x.r.diagnostico] : null,
        fecha_diagnostico: repetir ? x.r.fecha_diagnostico : null,
        desde: x.s.desde,
        hasta: x.s.hasta,
        situacion: x.texto,
      },
    };
  });

  const cuenta = (f: (x: Fila) => boolean) => cifra(servidas.filter(f).length);
  const indicadores: Indicador[] = [
    { etiqueta: "Servidas sin confirmar", valor: cuenta(() => true) },
    { etiqueta: "Ya toca", valor: cuenta((x) => x.s.estado === "toca") },
    { etiqueta: "Atrasadas", valor: cuenta((x) => x.s.estado === "atrasado"), alerta: servidas.some((x) => x.s.estado === "atrasado") },
    { etiqueta: "Aún no", valor: cuenta((x) => x.s.estado === "pronto") },
    { etiqueta: "Para repetir (dudosas)", valor: cuenta((x) => x.s.clase === "repetir") },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.fecha("servicio", "Último servicio"),
      col.texto("tipo_servicio", "Servicio", 20),
      col.texto("reproductor", "Reproductor", 22),
      col.entero("dias_servicio", "Días desde el servicio", 14),
      col.texto("diagnostico_previo", "Diagnóstico previo", 16),
      col.fecha("fecha_diagnostico", "Fecha del diagnóstico previo"),
      col.fecha("desde", "Diagnosticar desde"),
      col.fecha("hasta", "Diagnosticar hasta"),
      col.texto("situacion", "Situación", 28, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informePorPalpar(c: ContextoReporte): Promise<ResultadoReporte> {
  const base = await cargarReproBase(c);
  const servicios = await cargarServicios(c, base.repro.filter((r) => r.estado === "servida" && r.servicio_id).map((r) => r.servicio_id!));
  const g = c.ajustes.general;
  return construirPorPalpar({
    hoy: c.hoy,
    momento: c.filtros.momento ?? "todos",
    ventana: { desde: g.dx_prenez_dia_desde, hasta: g.dx_prenez_dia_hasta },
    repro: base.repro,
    animales: base.animales,
    servicios,
    truncado: base.truncado,
  });
}
