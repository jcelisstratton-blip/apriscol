import { sumarDias } from "@/lib/fechas";

/** Una fila de `produccion_historial`: lo ordeñado en un día y una jornada. */
export type FilaHistorial = {
  fecha: string;
  jornada: string;
  litros_tanque: number;
  litros_descartados: number;
  ordenos: number;
  animales: number;
};

export type PeriodoId = "7" | "30" | "90" | "365" | "todo" | "rango";
export const PERIODOS: { id: PeriodoId; texto: string }[] = [
  { id: "7", texto: "7 días" },
  { id: "30", texto: "30 días" },
  { id: "90", texto: "90 días" },
  { id: "365", texto: "1 año" },
  { id: "todo", texto: "Todo" },
  { id: "rango", texto: "Fechas" },
];

const MAX_DIAS = 800;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);

export type PeriodoResuelto = {
  id: PeriodoId;
  desde: string;
  hasta: string;
  /** Cantidad de días del periodo (contando el primero y el último). */
  dias: number;
  /** El periodo inmediatamente anterior y de igual largo, para comparar. No hay con «Todo». */
  anterior: { desde: string; hasta: string } | null;
};

/**
 * Convierte lo que pide la persona (7, 30, 90 días, 1 año, todo o unas fechas) en un rango de fechas. Nunca pasa de hoy ni de 800 días;
 * unas fechas que no sirven vuelven a los últimos 30 días. «Todo» empieza en el primer ordeño de la finca.
 */
export function resolverPeriodo(pedido: { periodo?: string; desde?: string; hasta?: string }, hoy: string, primerOrdeno: string | null): PeriodoResuelto {
  let id: PeriodoId = (PERIODOS.some((p) => p.id === pedido.periodo) ? pedido.periodo : "30") as PeriodoId;
  let desde: string;
  let hasta = hoy;

  if (id === "rango") {
    const d = pedido.desde ?? "";
    const h = pedido.hasta ?? "";
    if (ES_FECHA.test(d) && ES_FECHA.test(h) && d <= h) {
      desde = d;
      hasta = h > hoy ? hoy : h;
      if (desde > hasta) desde = hasta;
    } else {
      id = "30";
      desde = sumarDias(hoy, -29);
    }
  } else if (id === "todo") {
    desde = primerOrdeno && primerOrdeno <= hoy ? primerOrdeno : sumarDias(hoy, -29);
  } else {
    desde = sumarDias(hoy, -(Number(id) - 1));
  }
  if (diasEntre(desde, hasta) + 1 > MAX_DIAS) desde = sumarDias(hasta, -(MAX_DIAS - 1));

  const dias = diasEntre(desde, hasta) + 1;
  const anterior = id === "todo" ? null : { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
  return { id, desde, hasta, dias, anterior };
}

export type Totales = {
  tanque: number;
  descartados: number;
  ordenos: number;
  /** Días en que hubo al menos un ordeño. */
  diasConOrdeno: number;
  /** Litros por día de ordeño (solo cuenta los días con registro). */
  promedioDia: number;
  porJornada: Record<string, number>;
  mejorDia: { fecha: string; litros: number } | null;
  /** Cuántos animales distintos se ordeñaron en el mejor día de la finca (solo informativo). */
  animalesMax: number;
};

export function calcularTotales(filas: FilaHistorial[]): Totales {
  const porDia = new Map<string, number>();
  const porJornada: Record<string, number> = {};
  let tanque = 0;
  let descartados = 0;
  let ordenos = 0;
  let animalesMax = 0;
  for (const f of filas) {
    tanque += f.litros_tanque;
    descartados += f.litros_descartados;
    ordenos += f.ordenos;
    animalesMax = Math.max(animalesMax, f.animales);
    porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.litros_tanque);
    porJornada[f.jornada] = (porJornada[f.jornada] ?? 0) + f.litros_tanque;
  }
  let mejorDia: Totales["mejorDia"] = null;
  for (const [fecha, litros] of porDia) if (!mejorDia || litros > mejorDia.litros) mejorDia = { fecha, litros };
  return { tanque, descartados, ordenos, diasConOrdeno: porDia.size, promedioDia: porDia.size ? tanque / porDia.size : 0, porJornada, mejorDia, animalesMax };
}

/** Cambio frente al periodo anterior: 0,12 = 12 % más. `null` si no hay con qué comparar. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior > 0 ? (actual - anterior) / anterior : null;
}

export type Barra = {
  clave: string;
  /** Primer y último día que cubre la barra (iguales si es un día). */
  desde: string;
  hasta: string;
  manana: number;
  tarde: number;
  noche: number;
  unico: number;
  descartados: number;
  /** Litros al tanque. */
  total: number;
};
export type Paso = "dia" | "semana" | "mes";

const lunesDe = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};
const finDeMes = (iso: string) => {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

/**
 * Agrupa lo ordeñado en barras para la gráfica: por día hasta 120 días, por semana hasta 400 y por mes más allá. Las barras sin
 * ordeño quedan en cero para que el eje de tiempo sea continuo.
 */
export function construirSerie(filas: FilaHistorial[], desde: string, hasta: string): { paso: Paso; barras: Barra[] } {
  const dias = diasEntre(desde, hasta) + 1;
  const paso: Paso = dias <= 120 ? "dia" : dias <= 400 ? "semana" : "mes";
  const inicioDe = (f: string) => (paso === "dia" ? f : paso === "semana" ? lunesDe(f) : `${f.slice(0, 7)}-01`);
  const finDe = (i: string) => (paso === "dia" ? i : paso === "semana" ? sumarDias(i, 6) : finDeMes(i));
  const siguiente = (i: string) => (paso === "dia" ? sumarDias(i, 1) : paso === "semana" ? sumarDias(i, 7) : sumarDias(finDeMes(i), 1));

  const mapa = new Map<string, Barra>();
  for (let i = inicioDe(desde); i <= hasta; i = siguiente(i)) {
    mapa.set(i, { clave: i, desde: i < desde ? desde : i, hasta: finDe(i) > hasta ? hasta : finDe(i), manana: 0, tarde: 0, noche: 0, unico: 0, descartados: 0, total: 0 });
  }
  for (const f of filas) {
    const b = mapa.get(inicioDe(f.fecha));
    if (!b) continue;
    const j = f.jornada === "manana" || f.jornada === "tarde" || f.jornada === "noche" ? f.jornada : "unico";
    b[j] += f.litros_tanque;
    b.total += f.litros_tanque;
    b.descartados += f.litros_descartados;
  }
  return { paso, barras: [...mapa.values()] };
}

export const ETIQUETA_JORNADA: Record<string, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche", unico: "Único" };
