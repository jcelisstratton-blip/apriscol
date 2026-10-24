import { ETIQUETA_CAUSA, ETIQUETA_PARTO } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import { traerTodo } from "@/lib/consultas";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { promedio, suma } from "@/lib/reportes/calculos";
import { diasDesde } from "@/lib/fechas";
import { cifra, porcentaje } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { Cria, Parto, TipoParto } from "@/lib/tipos";

export type PartoBase = Pick<Parto, "id" | "madre_id" | "fecha" | "tipo" | "complicaciones" | "causa_aborto" | "asistido_por" | "observaciones">;
export type CriaBase = Pick<Cria, "parto_id" | "sexo" | "vivo" | "peso_nacer_kg">;

export type DatosPartos = {
  tipo: string;
  rango: { desde: string | null; hasta: string | null };
  /** Todos los partos de la finca: el intervalo entre partos necesita el anterior de cada hembra, esté o no en el periodo. */
  partos: PartoBase[];
  crias: CriaBase[];
  animales: Map<string, AnimalBase>;
  especie: (a: AnimalBase) => boolean;
  hoy: string;
  truncado: boolean;
};

const TONO: Record<TipoParto, TonoFila> = { normal: "ok", asistido: "aviso", cesarea: "aviso", aborto: "alerta" };

/**
 * Días entre cada parto (no aborto) y el anterior de la misma hembra. El primero de cada hembra no tiene intervalo.
 * Devuelve un mapa parto → días.
 */
export function intervalosEntrePartos(partos: Pick<PartoBase, "id" | "madre_id" | "fecha" | "tipo">[]): Map<string, number> {
  const porMadre = new Map<string, typeof partos>();
  for (const p of partos) {
    if (p.tipo === "aborto") continue;
    porMadre.set(p.madre_id, [...(porMadre.get(p.madre_id) ?? []), p]);
  }
  const intervalos = new Map<string, number>();
  for (const lista of porMadre.values()) {
    const ordenados = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (let i = 1; i < ordenados.length; i++) {
      const dias = diasDesde(ordenados[i - 1].fecha, ordenados[i].fecha);
      if (dias > 0) intervalos.set(ordenados[i].id, dias);
    }
  }
  return intervalos;
}

/** Los partos y abortos del periodo con sus crías, y los indicadores de eficiencia reproductiva del periodo. */
export function construirPartos(d: DatosPartos): ResultadoReporte {
  const criasDe = new Map<string, CriaBase[]>();
  for (const c of d.crias) criasDe.set(c.parto_id, [...(criasDe.get(c.parto_id) ?? []), c]);
  const intervalos = intervalosEntrePartos(d.partos);

  const delPeriodo = d.partos
    .filter((p) => (!d.rango.desde || p.fecha >= d.rango.desde) && (!d.rango.hasta || p.fecha <= d.rango.hasta))
    .filter((p) => {
      const a = d.animales.get(p.madre_id);
      return a ? d.especie(a) : true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));

  const detalle = delPeriodo.map((p) => {
    const crias = criasDe.get(p.id) ?? [];
    return { p, crias, vivas: crias.filter((c) => c.vivo).length };
  });

  const filas: FilaReporte[] = detalle
    .filter(({ p }) => d.tipo === "todos" || p.tipo === d.tipo)
    .map(({ p, crias, vivas }) => {
      const madre = d.animales.get(p.madre_id);
      const pesos = crias.flatMap((c) => (c.peso_nacer_kg === null ? [] : [Number(c.peso_nacer_kg)]));
      return {
        id: p.id,
        titulo: madre ? tituloAnimal(madre) : "Hembra eliminada",
        href: madre ? hrefAnimal(madre.id, "#reproduccion") : undefined,
        tono: TONO[p.tipo],
        valores: {
          ...(madre ? valoresAnimal(madre) : { arete: null, nombre: null }),
          fecha: p.fecha,
          evento: ETIQUETA_PARTO[p.tipo],
          crias: p.tipo === "aborto" ? null : crias.length,
          vivas: p.tipo === "aborto" ? null : vivas,
          muertas: p.tipo === "aborto" ? null : crias.length - vivas,
          machos: p.tipo === "aborto" ? null : crias.filter((c) => c.sexo === "macho").length,
          hembras: p.tipo === "aborto" ? null : crias.filter((c) => c.sexo === "hembra").length,
          peso_nacer: promedio(pesos),
          intervalo: intervalos.get(p.id) ?? null,
          asistido_por: p.asistido_por,
          causa: p.causa_aborto ? ETIQUETA_CAUSA[p.causa_aborto] : null,
          complicaciones: p.complicaciones,
          observaciones: p.observaciones,
        },
      };
    });

  const partosReales = detalle.filter(({ p }) => p.tipo !== "aborto");
  const abortos = detalle.length - partosReales.length;
  const nacidas = suma(partosReales.map((x) => x.crias.length));
  const vivas = suma(partosReales.map((x) => x.vivas));
  const multiples = partosReales.filter((x) => x.crias.length >= 2).length;
  const asistidos = partosReales.filter((x) => x.p.tipo !== "normal").length;
  const intervaloMedio = promedio(partosReales.flatMap((x) => (intervalos.has(x.p.id) ? [intervalos.get(x.p.id)!] : [])));

  const indicadores: Indicador[] = [
    { etiqueta: "Partos", valor: cifra(partosReales.length) },
    { etiqueta: "Abortos", valor: cifra(abortos), alerta: abortos > 0 },
    { etiqueta: "Crías nacidas", valor: cifra(nacidas) },
    { etiqueta: "Crías vivas", valor: cifra(vivas) },
    { etiqueta: "Mortalidad al nacer", valor: porcentaje(nacidas - vivas, nacidas, 1), alerta: nacidas > 0 && (nacidas - vivas) / nacidas > 0.1 },
    { etiqueta: "Prolificidad", valor: partosReales.length > 0 ? cifra(nacidas / partosReales.length, 2) : "—", detalle: "Crías por parto" },
    { etiqueta: "Partos múltiples", valor: porcentaje(multiples, partosReales.length) },
    { etiqueta: "Asistidos o cesáreas", valor: porcentaje(asistidos, partosReales.length) },
    { etiqueta: "Tasa de abortos", valor: porcentaje(abortos, partosReales.length + abortos, 1) },
    { etiqueta: "Intervalo entre partos", valor: intervaloMedio === null ? "—" : `${cifra(Math.round(intervaloMedio))} días` },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.fecha("fecha", "Fecha"),
      col.texto("evento", "Evento", 16, { insignia: true }),
      col.entero("crias", "Crías", 8),
      col.entero("vivas", "Vivas", 8),
      col.entero("muertas", "Muertas", 8),
      col.entero("machos", "Machos", 8),
      col.entero("hembras", "Hembras", 8),
      col.decimal("peso_nacer", "Peso al nacer (kg, promedio)", 14, 2),
      col.entero("intervalo", "Días desde el parto anterior", 14),
      col.texto("asistido_por", "Asistido por", 22),
      col.texto("causa", "Causa del aborto", 18),
      col.texto("complicaciones", "Complicaciones", 28),
      col.texto("observaciones", "Observaciones", 28),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informePartos(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, partos, crias] = await Promise.all([
    cargarAnimales(c),
    traerTodo<PartoBase>((d, h) =>
      c.supabase.from("partos").select("id, madre_id, fecha, tipo, complicaciones, causa_aborto, asistido_por, observaciones").eq("finca_id", c.fincaId).order("fecha").order("id").range(d, h),
    ),
    traerTodo<CriaBase>((d, h) => c.supabase.from("crias").select("parto_id, sexo, vivo, peso_nacer_kg").eq("finca_id", c.fincaId).order("id").range(d, h)),
  ]);
  return construirPartos({
    tipo: c.filtros.tipo ?? "todos",
    rango: c.rango,
    partos: partos.filas,
    crias: crias.filas,
    animales: animales.porId,
    especie: (a) => pasaEspecie(c, a.especie),
    hoy: c.hoy,
    truncado: animales.truncado || partos.truncado || crias.truncado,
  });
}
