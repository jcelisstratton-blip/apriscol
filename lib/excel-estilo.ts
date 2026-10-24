import type ExcelJS from "exceljs";

/** Colores y formatos que comparten todos los Excel que genera Apriscol (reportes de costos, plantilla de cargue y exportación de la finca). */
export const COLOR = { musgo: "FF2F5A45", lana: "FFF5F0E6", arena: "FFE6DEC9", ocre: "FFB07A2A", blanco: "FFFFFFFF", tinta: "FF1F1B16", humo: "FF6B6457" } as const;

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

const FUENTE = "Calibri";

/** Una fecha AAAA-MM-DD como fecha de Excel (a medianoche UTC, para que no se corra de día con la zona horaria). */
export function aFechaExcel(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** Una fecha AAAA-MM-DD como la escribe una persona: 24/10/2026. */
export function textoFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Un texto sin los caracteres que un sistema de archivos rechaza (para nombres de archivo y de hoja). */
export const limpiarNombreArchivo = (t: string): string => t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();

export type LineaTitulo = { texto: string; size?: number; bold?: boolean; color?: string };

/** Las primeras filas de una hoja: el título (finca, reporte, periodo, filtros, fecha), cada línea combinada a lo ancho de las `columnas`. */
export function escribirTitulo(ws: ExcelJS.Worksheet, columnas: number, lineas: LineaTitulo[]): void {
  lineas.forEach((l, i) => {
    const fila = i + 1;
    ws.mergeCells(fila, 1, fila, Math.max(columnas, 1));
    const celda = ws.getCell(fila, 1);
    celda.value = l.texto;
    celda.font = { name: FUENTE, size: l.size ?? 11, bold: l.bold ?? false, color: { argb: l.color ?? COLOR.tinta } };
    celda.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
  ws.getRow(1).height = 24;
}

/** La fila de títulos de columna (blanco sobre musgo) y la hoja lista para leer: títulos fijos al desplazarse, horizontal y con numeración de páginas. */
export function escribirEncabezados(ws: ExcelJS.Worksheet, fila: number, columnas: { titulo: string; derecha: boolean }[], alto = 32): void {
  const r = ws.getRow(fila);
  columnas.forEach((c, i) => {
    const celda = r.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { name: FUENTE, bold: true, color: { argb: COLOR.blanco } };
    celda.fill = relleno(COLOR.musgo);
    celda.alignment = { vertical: "middle", horizontal: c.derecha ? "right" : "left", wrapText: true };
  });
  r.height = alto;
  ws.views = [{ state: "frozen", ySplit: fila, xSplit: 0 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.headerFooter = { oddFooter: "&L&A&RPágina &P de &N" };
}
