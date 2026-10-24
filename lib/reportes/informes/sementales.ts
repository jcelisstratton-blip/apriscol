import { ETIQUETA_SERVICIO, TIPOS_SERVICIO } from "@/lib/reproduccion";
import { NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, traerTodo } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { proporcion, resultadoServicio, servicioPreno, servicioResuelto, suma } from "@/lib/reportes/calculos";
import type { ResultadoServicio } from "@/lib/reportes/calculos";
import { cifra, porcentaje } from "@/lib/reportes/formato";
import type { DiagnosticoBase, ServicioBase } from "@/lib/reportes/informes/repro-comun";
import type { FilaReporte, Indicador, ResultadoReporte } from "@/lib/reportes/tipos";
import type { Cria, Parto, TipoServicio } from "@/lib/tipos";

export type PartoDeServicio = Pick<Parto, "id" | "servicio_id" | "tipo">;
export type CriaDeParto = Pick<Cria, "parto_id" | "vivo">;

export type DatosSementales = {
  tipo: string;
  rango: { desde: string | null; hasta: string | null };
  servicios: ServicioBase[];
  diagnosticos: DiagnosticoBase[];
  partos: PartoDeServicio[];
  crias: CriaDeParto[];
  animales: Map<string, AnimalBase>;
  especie: (a: AnimalBase) => boolean;
  truncado: boolean;
};

/** Menos servicios resueltos que estos y la tasa de preñez de un reproductor es poco confiable. */
export const MINIMO_CONFIABLE = 10;

type Resuelto = { s: ServicioBase; resultado: ResultadoServicio; nacidas: number; vivas: number };

/** Qué le pasó a cada servicio, con las crías que dejó. El parto registrado manda sobre el diagnóstico. */
export function resolverServicios(d: Pick<DatosSementales, "servicios" | "diagnosticos" | "partos" | "crias">): Resuelto[] {
  const ultimoDx = new Map<string, DiagnosticoBase>();
  for (const dx of d.diagnosticos) {
    if (!dx.servicio_id) continue;
    const previo = ultimoDx.get(dx.servicio_id);
    if (!previo || dx.fecha > previo.fecha) ultimoDx.set(dx.servicio_id, dx);
  }
  const partoDe = new Map<string, PartoDeServicio>();
  for (const p of d.partos) {
    if (!p.servicio_id) continue;
    const previo = partoDe.get(p.servicio_id);
    // Si hay un aborto y un parto del mismo servicio, el parto es lo que importa.
    if (!previo || (previo.tipo === "aborto" && p.tipo !== "aborto")) partoDe.set(p.servicio_id, p);
  }
  const criasDe = new Map<string, CriaDeParto[]>();
  for (const c of d.crias) criasDe.set(c.parto_id, [...(criasDe.get(c.parto_id) ?? []), c]);

  return d.servicios.map((s) => {
    const parto = partoDe.get(s.id);
    const dx = ultimoDx.get(s.id);
    const crias = parto && parto.tipo !== "aborto" ? (criasDe.get(parto.id) ?? []) : [];
    return {
      s,
      resultado: resultadoServicio(parto?.tipo ?? null, dx?.resultado ?? null),
      nacidas: crias.length,
      vivas: crias.filter((c) => c.vivo).length,
    };
  });
}

const llave = (s: ServicioBase) => (s.macho_id ? `id:${s.macho_id}` : s.macho_externo?.trim() ? `ext:${s.macho_externo.trim().toLowerCase()}` : "sin");

/**
 * El rendimiento de cada reproductor en el periodo: cuántos servicios dio, cuántos ya tienen resultado, cuántos quedaron preñados y cuántas crías dejó.
 * Arriba se compara la tasa de preñez de la monta natural, la inseminación y la transferencia de embriones.
 */
export function construirSementales(d: DatosSementales): ResultadoReporte {
  const enPeriodo = d.servicios.filter((s) => {
    if (d.rango.desde && s.fecha < d.rango.desde) return false;
    if (d.rango.hasta && s.fecha > d.rango.hasta) return false;
    const hembra = d.animales.get(s.hembra_id);
    return hembra ? d.especie(hembra) : true;
  });
  const resueltos = resolverServicios({ ...d, servicios: enPeriodo });
  const visibles = resueltos.filter((x) => d.tipo === "todos" || x.s.tipo === d.tipo);

  const grupos = new Map<string, Resuelto[]>();
  for (const x of visibles) grupos.set(llave(x.s), [...(grupos.get(llave(x.s)) ?? []), x]);

  const filas: FilaReporte[] = [...grupos.entries()]
    .map(([clave, lista]) => {
      const primero = lista[0].s;
      const interno = primero.macho_id ? d.animales.get(primero.macho_id) : undefined;
      const conResultado = lista.filter((x) => servicioResuelto(x.resultado));
      const prenados = conResultado.filter((x) => servicioPreno(x.resultado)).length;
      const partos = lista.filter((x) => x.resultado === "parto");
      const nacidas = suma(partos.map((x) => x.nacidas));
      const vivas = suma(partos.map((x) => x.vivas));
      const nombre = interno ? tituloAnimal(interno) : (primero.macho_externo?.trim() ?? "Sin reproductor registrado");
      const fila: FilaReporte = {
        id: clave,
        titulo: nombre,
        href: interno ? hrefAnimal(interno.id) : undefined,
        tono: "neutro",
        valores: {
          reproductor: nombre,
          origen: interno ? "Del hato" : clave === "sin" ? "Sin dato" : "De fuera",
          servicios: lista.length,
          pendientes: lista.length - conResultado.length,
          prenados,
          tasa: proporcion(prenados, conResultado.length),
          partos: partos.length,
          abortos: lista.filter((x) => x.resultado === "aborto").length,
          crias: nacidas,
          vivas,
          prolificidad: partos.length > 0 ? nacidas / partos.length : null,
          mortalidad: proporcion(nacidas - vivas, nacidas),
          ultimo: lista.reduce((m, x) => (x.s.fecha > m ? x.s.fecha : m), ""),
        },
      };
      return { fila, resueltos: conResultado.length, servicios: lista.length };
    })
    .sort((a, b) => b.servicios - a.servicios || a.fila.titulo.localeCompare(b.fila.titulo, "es"))
    .map((x) => x.fila);

  const indicadores: Indicador[] = [
    { etiqueta: "Servicios", valor: cifra(resueltos.length) },
    { etiqueta: "Pendientes", valor: cifra(resueltos.filter((x) => !servicioResuelto(x.resultado)).length), detalle: "Sin diagnóstico ni parto" },
  ];
  for (const tipo of TIPOS_SERVICIO as TipoServicio[]) {
    const delTipo = resueltos.filter((x) => x.s.tipo === tipo);
    if (delTipo.length === 0) continue;
    const conResultado = delTipo.filter((x) => servicioResuelto(x.resultado));
    indicadores.push({
      etiqueta: `Preñez · ${ETIQUETA_SERVICIO[tipo]}`,
      valor: porcentaje(conResultado.filter((x) => servicioPreno(x.resultado)).length, conResultado.length),
      detalle: `${cifra(delTipo.length)} ${delTipo.length === 1 ? "servicio" : "servicios"}`,
    });
  }

  const hayPocos = [...grupos.values()].some((l) => l.filter((x) => servicioResuelto(x.resultado)).length < MINIMO_CONFIABLE);
  return {
    columnas: [
      col.texto("reproductor", "Reproductor", 26, { soloExcel: true }),
      col.texto("origen", "Origen", 12, { insignia: true }),
      col.entero("servicios", "Servicios", 11),
      col.entero("pendientes", "Pendientes", 12),
      col.entero("prenados", "Preñados", 11),
      col.porcentaje("tasa", "Tasa de preñez", 14),
      col.entero("partos", "Partos", 9),
      col.entero("abortos", "Abortos", 9),
      col.entero("crias", "Crías nacidas", 12),
      col.entero("vivas", "Crías vivas", 11),
      col.decimal("prolificidad", "Crías por parto", 12, 2),
      col.porcentaje("mortalidad", "Mortalidad al nacer", 14),
      col.fecha("ultimo", "Último servicio"),
    ],
    filas,
    indicadores,
    notas: [
      ...(hayPocos ? [`Con menos de ${MINIMO_CONFIABLE} servicios con resultado, la tasa de preñez de un reproductor no es confiable: fíjate también en cuántos servicios fueron.`] : []),
      ...(d.truncado ? [NOTA_TRUNCADO] : []),
    ],
  };
}

export async function informeSementales(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, servicios, diagnosticos, partos, crias] = await Promise.all([
    cargarAnimales(c),
    traerTodo<ServicioBase>((d, h) => c.supabase.from("servicios").select("id, hembra_id, fecha, tipo, macho_id, macho_externo").eq("finca_id", c.fincaId).order("fecha").order("id").range(d, h)),
    traerTodo<DiagnosticoBase>((d, h) => c.supabase.from("diagnosticos_gestacion").select("id, hembra_id, servicio_id, fecha, resultado, num_fetos").eq("finca_id", c.fincaId).order("fecha").order("id").range(d, h)),
    traerTodo<PartoDeServicio>((d, h) => c.supabase.from("partos").select("id, servicio_id, tipo").eq("finca_id", c.fincaId).not("servicio_id", "is", null).order("id").range(d, h)),
    traerTodo<CriaDeParto>((d, h) => c.supabase.from("crias").select("parto_id, vivo").eq("finca_id", c.fincaId).order("id").range(d, h)),
  ]);
  return construirSementales({
    tipo: c.filtros.servicio ?? "todos",
    rango: c.rango,
    servicios: servicios.filas,
    diagnosticos: diagnosticos.filas,
    partos: partos.filas,
    crias: crias.filas,
    animales: animales.porId,
    especie: (a) => pasaEspecie(c, a.especie),
    truncado: animales.truncado || servicios.truncado || diagnosticos.truncado || partos.truncado || crias.truncado,
  });
}
