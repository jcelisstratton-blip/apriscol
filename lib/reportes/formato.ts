import { formatoFecha } from "@/lib/fechas";
import type { Celda, Columna } from "@/lib/reportes/tipos";

const numero = (decimales: number) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const FORMATOS = new Map<number, Intl.NumberFormat>();
const formato = (d: number) => {
  let f = FORMATOS.get(d);
  if (!f) FORMATOS.set(d, (f = numero(d)));
  return f;
};

/** El valor de una celda como lo lee una persona: números a la colombiana (coma decimal, punto de miles), fechas cortas, vacío = «—». */
export function textoCelda(columna: Pick<Columna, "tipo" | "decimales">, valor: Celda): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (columna.tipo) {
    case "fecha":
      return formatoFecha(String(valor));
    case "entero":
      return formato(0).format(Number(valor));
    case "decimal":
      return formato(columna.decimales ?? 1).format(Number(valor));
    case "porcentaje":
      return `${formato(columna.decimales ?? 1).format(Number(valor) * 100)} %`;
    case "pesos":
      return `$ ${formato(0).format(Number(valor))}`;
    default:
      return String(valor);
  }
}

/** Un número de un indicador: «1.250», «3,6». */
export const cifra = (n: number, decimales = 0) => formato(decimales).format(n);

/** Una proporción como porcentaje de un indicador, o «—» si no se puede calcular (se divide entre cero). */
export const porcentaje = (parte: number, total: number, decimales = 0) => (total > 0 ? `${formato(decimales).format((parte / total) * 100)} %` : "—");

/** «1 animal», «3 animales». */
export const plural = (n: number, uno: string, varios: string) => `${formato(0).format(n)} ${n === 1 ? uno : varios}`;
