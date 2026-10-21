import type ExcelJS from "exceljs";

/** Colores y formatos que comparten todos los Excel que genera Apriscol (reportes de costos, plantilla de cargue y exportación de la finca). */
export const COLOR = { musgo: "FF2F5A45", lana: "FFF5F0E6", arena: "FFE6DEC9", ocre: "FFB07A2A", blanco: "FFFFFFFF" } as const;

export const FMT = {
  pesos: '"$" #,##0;[Red]-"$" #,##0',
  fecha: "dd/mm/yyyy",
  fechaHora: "dd/mm/yyyy hh:mm",
  litros: "#,##0.0",
  porcentaje: "0.0%",
} as const;

export const relleno = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Celda de título de columna: texto blanco en negrita sobre musgo (u otro color). */
export function estiloEncabezado(celda: ExcelJS.Cell, argb: string = COLOR.musgo) {
  celda.font = { bold: true, color: { argb: COLOR.blanco } };
  celda.fill = relleno(argb);
}
