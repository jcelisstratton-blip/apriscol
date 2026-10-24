import { nombreTipo } from "@/lib/animal";
import { sumarDias } from "@/lib/fechas";
import { DIAS_REPETIR_DX_DESDE, DIAS_REPETIR_DX_HASTA, ETIQUETA_RESULTADO, enObservacion } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, col, hrefAnimal, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { compararArete, diasDesde, situacionDiagnostico } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import { cargarReproBase, cargarServicios, reproductorDe, tipoServicio } from "@/lib/reportes/informes/repro-comun";
import type { ServicioBase } from "@/lib/reportes/informes/repro-comun";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { ReproHembra } from "@/lib/tipos";

export type DatosPorPalpar = {
  hoy: string;
  momento: string;
  /** Desde y hasta qué día después del servicio se diagnostica, según los Ajustes de la finca. */
  ventana: { desde: number; hasta: number };
  repro: ReproHembra[];
  animales: Map<string, AnimalBase>;
  servicios: Map<string, ServicioBase>;
  truncado: boolean;
};

type Fila = {
  r: ReproHembra;
  a: AnimalBase;
  dias: number;
  /** «toca» ya hay que diagnosticar (o repetir); «pronto» aún no; «atrasado» pasó la ventana. */
  estado: "pronto" | "toca" | "atrasado";
  repetir: boolean;
  texto: string;
  tono: TonoFila;
  desde: string;
  hasta: string;
};

const GRAVEDAD = { atrasado: 0, toca: 1, pronto: 2 } as const;

/** Las hembras servidas que aún no tienen un diagnóstico de gestación que las confirme o las descarte, y qué toca hacer con cada una. */
export function construirPorPalpar(d: DatosPorPalpar): ResultadoReporte {
  const servidas: Fila[] = d.repro
    .filter((r) => r.estado === "servida" && r.ultimo_servicio)
    .flatMap((r): Fila[] => {
      const a = d.animales.get(r.animal_id);
      if (!a || a.estado !== "activo") return [];
      if (enObservacion(r)) {
        // Diagnóstico dudoso: se repite entre 14 y 21 días después.
        const dias = diasDesde(r.fecha_diagnostico!, d.hoy);
        const estado = dias < DIAS_REPETIR_DX_DESDE ? "pronto" : dias <= DIAS_REPETIR_DX_HASTA ? "toca" : "atrasado";
        const texto = estado === "pronto" ? `Repetir en ${DIAS_REPETIR_DX_DESDE - dias} ${DIAS_REPETIR_DX_DESDE - dias === 1 ? "día" : "días"}` : estado === "toca" ? "Toca repetir el diagnóstico" : `Repetición atrasada ${dias - DIAS_REPETIR_DX_HASTA} días`;
        return [{ r, a, dias, estado, repetir: true, texto, tono: estado === "atrasado" ? "alerta" : estado === "toca" ? "aviso" : "neutro", desde: sumarDias(r.fecha_diagnostico!, DIAS_REPETIR_DX_DESDE), hasta: sumarDias(r.fecha_diagnostico!, DIAS_REPETIR_DX_HASTA) } satisfies Fila];
      }
      const dias = diasDesde(r.ultimo_servicio!, d.hoy);
      const estado = situacionDiagnostico(dias, d.ventana.desde, d.ventana.hasta);
      const faltan = d.ventana.desde - dias;
      const texto = estado === "pronto" ? `Faltan ${faltan} ${faltan === 1 ? "día" : "días"}` : estado === "toca" ? "Toca diagnosticar" : `Diagnóstico atrasado ${dias - d.ventana.hasta} días`;
      return [{ r, a, dias, estado, repetir: false, texto, tono: estado === "atrasado" ? "alerta" : estado === "toca" ? "aviso" : "neutro", desde: sumarDias(r.ultimo_servicio!, d.ventana.desde), hasta: sumarDias(r.ultimo_servicio!, d.ventana.hasta) } satisfies Fila];
    });

  const pasa = (x: Fila) => (d.momento === "toca" ? x.estado !== "pronto" : d.momento === "pronto" ? x.estado === "pronto" : d.momento === "repetir" ? x.repetir : true);
  const visibles = servidas.filter(pasa).sort((x, y) => GRAVEDAD[x.estado] - GRAVEDAD[y.estado] || y.dias - x.dias || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const s = x.r.servicio_id ? d.servicios.get(x.r.servicio_id) : undefined;
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: x.repetir ? `/hato/${x.a.id}/reproduccion/diagnostico/nuevo` : hrefAnimal(x.a.id, "#reproduccion"),
      tono: x.tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        servicio: x.r.ultimo_servicio,
        tipo_servicio: tipoServicio(s),
        reproductor: reproductorDe(s, d.animales),
        dias_servicio: diasDesde(x.r.ultimo_servicio!, d.hoy),
        diagnostico_previo: x.repetir && x.r.diagnostico ? ETIQUETA_RESULTADO[x.r.diagnostico] : null,
        fecha_diagnostico: x.repetir ? x.r.fecha_diagnostico : null,
        desde: x.desde,
        hasta: x.hasta,
        situacion: x.texto,
      },
    };
  });

  const cuenta = (f: (x: Fila) => boolean) => cifra(servidas.filter(f).length);
  const indicadores: Indicador[] = [
    { etiqueta: "Servidas sin confirmar", valor: cuenta(() => true) },
    { etiqueta: "Ya toca", valor: cuenta((x) => x.estado === "toca") },
    { etiqueta: "Atrasadas", valor: cuenta((x) => x.estado === "atrasado"), alerta: servidas.some((x) => x.estado === "atrasado") },
    { etiqueta: "Aún no", valor: cuenta((x) => x.estado === "pronto") },
    { etiqueta: "Para repetir (dudosas)", valor: cuenta((x) => x.repetir) },
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
