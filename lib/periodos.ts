import { sumarDias } from "@/lib/fechas";

/** Los periodos del filtro por fechas que comparten los menús (Sanidad, Corrales, resumen de empadronamientos…). */
export type Periodo = "todo" | "anio" | "12m" | "6m" | "3m" | "rango";
export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "todo", etiqueta: "Todo" },
  { valor: "anio", etiqueta: "Este año" },
  { valor: "12m", etiqueta: "12 meses" },
  { valor: "6m", etiqueta: "6 meses" },
  { valor: "3m", etiqueta: "3 meses" },
  { valor: "rango", etiqueta: "Entre fechas" },
];
export const esPeriodo = (v: string | undefined): v is Periodo => PERIODOS.some((p) => p.valor === v);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Entre qué fechas se miran los registros (nulo = sin límite). Una fecha mal escrita se ignora. */
export function rangoPeriodo(periodo: Periodo, hoy: string, desde?: string, hasta?: string): { desde: string | null; hasta: string | null } {
  const dias = (n: number) => sumarDias(hoy, -n);
  switch (periodo) {
    case "anio":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: null };
    case "12m":
      return { desde: dias(365), hasta: null };
    case "6m":
      return { desde: dias(182), hasta: null };
    case "3m":
      return { desde: dias(91), hasta: null };
    case "rango": {
      const d = desde && FECHA.test(desde) ? desde : null;
      const h = hasta && FECHA.test(hasta) ? hasta : null;
      return d && h && d > h ? { desde: h, hasta: d } : { desde: d, hasta: h };
    }
    default:
      return { desde: null, hasta: null };
  }
}
