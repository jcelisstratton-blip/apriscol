import { nombreTipo } from "@/lib/animal";
import { diasEntrePediluvios, mesDeFecha } from "@/lib/ajustes";
import { sumarDias } from "@/lib/fechas";
import { FAMACHA, estadoFamacha } from "@/lib/famacha";
import { ETIQUETA_EVENTO, estadoDosis } from "@/lib/sanidad";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, traerTodo, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { compararArete, diasDesde } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { FamachaAnimal, SanidadPendiente } from "@/lib/tipos";

/** Las dosis programadas que faltan más de estos días no se listan: aún no son para atender. */
export const DIAS_ADELANTE_DOSIS = 30;

export type UltimaRevision = { animal_id: string; ultima_fecha: string | null };

export type DatosSanidad = {
  hoy: string;
  tipo: string;
  podologiaCadaDias: number;
  pediluvioCadaDias: number;
  dosis: Pick<SanidadPendiente, "animal_id" | "evento_id" | "producto_nombre" | "proxima_fecha" | "tipo">[];
  famacha: Pick<FamachaAnimal, "animal_id" | "puntaje" | "ultima_fecha" | "desparasitado_en">[];
  podologia: UltimaRevision[];
  pediluvio: UltimaRevision[];
  animales: Map<string, AnimalBase>;
  especie: (a: AnimalBase) => boolean;
  truncado: boolean;
};

type Pendiente = {
  id: string;
  animal: AnimalBase;
  clase: "dosis" | "famacha" | "podologia" | "pediluvio";
  detalle: string;
  ultima: string | null;
  vence: string | null;
  situacion: string;
  tono: TonoFila;
  /** 0 = lo más urgente. */
  gravedad: number;
};

const ETIQUETA_CLASE = { dosis: "Dosis", famacha: "FAMACHA", podologia: "Podología", pediluvio: "Pediluvio" } as const;

/** Una revisión periódica (podología, pediluvio) está atrasada si nunca se hizo o si pasaron más días que los de la finca. */
function revisionAtrasada(r: UltimaRevision, cadaDias: number, hoy: string): { atrasada: false } | { atrasada: true; vence: string | null; texto: string; gravedad: number } {
  if (!r.ultima_fecha) return { atrasada: true, vence: null, texto: "Nunca se ha hecho", gravedad: 1 };
  const vence = sumarDias(r.ultima_fecha, cadaDias);
  if (vence >= hoy) return { atrasada: false };
  const atraso = diasDesde(vence, hoy);
  return { atrasada: true, vence, texto: `Atrasada ${atraso} ${atraso === 1 ? "día" : "días"}`, gravedad: 1 };
}

/** Todo lo que hay que atender en sanidad: dosis vencidas o próximas, animales con FAMACHA alto sin desparasitar, y podología y pediluvio atrasados. */
export function construirSanidad(d: DatosSanidad): ResultadoReporte {
  const pendientes: Pendiente[] = [];
  const visible = (id: string) => {
    const a = d.animales.get(id);
    return a && a.estado === "activo" && d.especie(a) ? a : undefined;
  };

  for (const p of d.dosis) {
    const a = visible(p.animal_id ?? "");
    if (!a || !p.proxima_fecha) continue;
    const e = estadoDosis(p.proxima_fecha, d.hoy);
    if (e.dias > DIAS_ADELANTE_DOSIS) continue;
    pendientes.push({
      id: `dosis:${a.id}:${p.evento_id}`,
      animal: a,
      clase: "dosis",
      detalle: p.producto_nombre?.trim() || (p.tipo ? ETIQUETA_EVENTO[p.tipo] : "Dosis programada"),
      ultima: null,
      vence: p.proxima_fecha,
      situacion: e.texto,
      tono: e.tono,
      gravedad: e.dias < 0 ? 0 : e.dias <= 7 ? 2 : 4,
    });
  }
  for (const f of d.famacha) {
    const a = visible(f.animal_id);
    if (!a) continue;
    const e = estadoFamacha({ puntaje: f.puntaje, ultima_fecha: f.ultima_fecha, desparasitado_en: f.desparasitado_en });
    if (e.clave !== "desparasitar" && e.clave !== "vigilar") continue;
    pendientes.push({
      id: `famacha:${a.id}`,
      animal: a,
      clase: "famacha",
      detalle: `Puntaje ${f.puntaje} · ${FAMACHA[f.puntaje]?.texto ?? ""}`.trim(),
      ultima: f.ultima_fecha,
      vence: null,
      situacion: e.texto,
      tono: e.tono,
      gravedad: e.clave === "desparasitar" ? 1 : 3,
    });
  }
  const revisiones = (lista: UltimaRevision[], cada: number, clase: "podologia" | "pediluvio") => {
    for (const r of lista) {
      const a = visible(r.animal_id);
      if (!a) continue;
      const x = revisionAtrasada(r, cada, d.hoy);
      if (!x.atrasada) continue;
      pendientes.push({
        id: `${clase}:${a.id}`,
        animal: a,
        clase,
        detalle: `Cada ${cada} días`,
        ultima: r.ultima_fecha,
        vence: x.vence,
        situacion: x.texto,
        tono: "aviso",
        gravedad: 3,
      });
    }
  };
  revisiones(d.podologia, d.podologiaCadaDias, "podologia");
  revisiones(d.pediluvio, d.pediluvioCadaDias, "pediluvio");

  const visibles = pendientes
    .filter((p) => d.tipo === "todos" || p.clase === d.tipo)
    .sort((x, y) => x.gravedad - y.gravedad || (x.vence ?? "9").localeCompare(y.vence ?? "9") || compararArete(x.animal.numero_arete, y.animal.numero_arete));

  const filas: FilaReporte[] = visibles.map((p) => ({
    id: p.id,
    titulo: tituloAnimal(p.animal),
    href: hrefAnimal(p.animal.id, "#sanidad"),
    tono: p.tono === "neutro" ? "neutro" : p.tono,
    valores: {
      ...valoresAnimal(p.animal),
      tipo: nombreTipo(p.animal.especie, p.animal.sexo),
      pendiente: ETIQUETA_CLASE[p.clase],
      detalle: p.detalle,
      ultima: p.ultima,
      vence: p.vence,
      situacion: p.situacion,
    },
  }));

  const n = (f: (p: Pendiente) => boolean) => pendientes.filter(f).length;
  const vencidas = n((p) => p.clase === "dosis" && p.gravedad === 0);
  const porDesparasitar = n((p) => p.clase === "famacha" && p.gravedad === 1);
  const indicadores: Indicador[] = [
    { etiqueta: "Dosis vencidas", valor: cifra(vencidas), alerta: vencidas > 0 },
    { etiqueta: `Dosis en ${DIAS_ADELANTE_DOSIS} días`, valor: cifra(n((p) => p.clase === "dosis" && p.gravedad > 0)) },
    { etiqueta: "FAMACHA por desparasitar", valor: cifra(porDesparasitar), alerta: porDesparasitar > 0 },
    { etiqueta: "FAMACHA por vigilar", valor: cifra(n((p) => p.clase === "famacha" && p.gravedad === 3)) },
    { etiqueta: "Podología atrasada", valor: cifra(n((p) => p.clase === "podologia")) },
    { etiqueta: "Pediluvio atrasado", valor: cifra(n((p) => p.clase === "pediluvio")) },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.texto("pendiente", "Pendiente", 12),
      col.texto("detalle", "Detalle", 28),
      col.fecha("ultima", "Última vez"),
      col.fecha("vence", "Debe hacerse el"),
      col.texto("situacion", "Situación", 26, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeSanidad(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, dosis, famacha, podologia, pediluvio] = await Promise.all([
    cargarAnimales(c),
    traerTodo<SanidadPendiente>((d, h) => c.supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", c.fincaId).order("proxima_fecha").order("evento_id").order("animal_id").range(d, h)),
    traerTodo<FamachaAnimal>((d, h) => c.supabase.from("v_famacha_animal").select("*").eq("finca_id", c.fincaId).gte("puntaje", 3).order("animal_id").range(d, h)),
    traerTodo<UltimaRevision>((d, h) => c.supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", c.fincaId).order("animal_id").range(d, h)),
    traerTodo<UltimaRevision>((d, h) => c.supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", c.fincaId).order("animal_id").range(d, h)),
  ]);
  const g = c.ajustes.general;
  return construirSanidad({
    hoy: c.hoy,
    tipo: c.filtros.tipo ?? "todos",
    podologiaCadaDias: g.podologia_inspeccion_dias,
    pediluvioCadaDias: diasEntrePediluvios(g, mesDeFecha(c.hoy)),
    dosis: dosis.filas,
    famacha: famacha.filas,
    podologia: podologia.filas,
    pediluvio: pediluvio.filas,
    animales: animales.porId,
    especie: (a) => pasaEspecie(c, a.especie),
    truncado: animales.truncado || dosis.truncado || famacha.truncado || podologia.truncado || pediluvio.truncado,
  });
}

