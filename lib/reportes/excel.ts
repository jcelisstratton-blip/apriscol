import ExcelJS from "exceljs";
import { COLOR, FMT } from "@/lib/excel-estilo";
import type { Columna, ReporteDef, ResultadoReporte } from "@/lib/reportes/tipos";

export type DatosLibro = {
  def: Pick<ReporteDef, "titulo">;
  finca: string;
  resultado: ResultadoReporte;
  /** El periodo en palabras («este año», «entre fechas»), si el reporte se mira por fechas. */
  periodo: { texto: string; desde: string | null; hasta: string | null } | null;
  filtros: string[];
  hoy: string;
  generado: Date;
};

const textoFecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const aFecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

function formatoExcel(c: Columna): string | undefined {
  switch (c.tipo) {
    case "fecha":
      return FMT.fecha;
    case "entero":
      return "#,##0";
    case "decimal":
      return `#,##0${(c.decimales ?? 1) > 0 ? `.${"0".repeat(c.decimales ?? 1)}` : ""}`;
    case "porcentaje":
      return FMT.porcentaje;
    case "pesos":
      return FMT.pesos;
    default:
      return undefined;
  }
}

/** El valor tal como va a la celda: fechas como fecha de verdad (se pueden ordenar y filtrar), números como números. */
function valorCelda(c: Columna, v: string | number | null): ExcelJS.CellValue {
  if (v === null || v === undefined || v === "") return null;
  if (c.tipo === "fecha") return aFecha(String(v));
  if (c.tipo === "texto") return String(v);
  return Number(v);
}

const FUENTE = "Calibri";

/** El Excel de un reporte: una hoja con los datos (todas las columnas, también las que en pantalla van en el título) y otra con los indicadores. */
export async function construirLibroReporte(d: DatosLibro): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Apriscol";
  wb.created = d.generado;
  wb.title = `${d.finca} - ${d.def.titulo}`;

  const cols = d.resultado.columnas;
  const ws = wb.addWorksheet(d.def.titulo.slice(0, 31));
  ws.columns = cols.map((c) => ({ width: c.ancho }));
  const n = Math.max(cols.length, 1);

  const linea = (fila: number, texto: string, o: { size?: number; bold?: boolean; color?: string } = {}) => {
    ws.mergeCells(fila, 1, fila, n);
    const celda = ws.getCell(fila, 1);
    celda.value = texto;
    celda.font = { name: FUENTE, size: o.size ?? 11, bold: o.bold ?? false, color: { argb: o.color ?? "FF1F1B16" } };
    celda.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  };
  linea(1, d.finca, { size: 16, bold: true, color: COLOR.musgo });
  linea(2, d.def.titulo, { size: 13, bold: true });
  linea(
    3,
    d.periodo
      ? d.periodo.desde || d.periodo.hasta
        ? `Periodo: del ${d.periodo.desde ? textoFecha(d.periodo.desde) : "inicio"} al ${d.periodo.hasta ? textoFecha(d.periodo.hasta) : textoFecha(d.hoy)} (${d.periodo.texto})`
        : `Periodo: ${d.periodo.texto}`
      : `Estado al ${textoFecha(d.hoy)}`,
  );
  linea(4, d.filtros.length > 0 ? `Filtros: ${d.filtros.join(" · ")}` : "Filtros: ninguno");
  linea(5, `Generado el ${textoFecha(d.generado.toISOString().slice(0, 10))} · ${d.resultado.filas.length} ${d.resultado.filas.length === 1 ? "registro" : "registros"}`, { color: "FF6B6457" });
  ws.getRow(1).height = 24;

  const encabezado = 7;
  const r = ws.getRow(encabezado);
  cols.forEach((c, i) => {
    const celda = r.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { name: FUENTE, bold: true, color: { argb: COLOR.blanco } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.musgo } };
    celda.alignment = { vertical: "middle", horizontal: c.tipo === "texto" ? "left" : "right", wrapText: true };
  });
  r.height = 32;

  d.resultado.filas.forEach((fila, k) => {
    const row = ws.getRow(encabezado + 1 + k);
    cols.forEach((c, i) => {
      const celda = row.getCell(i + 1);
      celda.value = valorCelda(c, fila.valores[c.clave] ?? null);
      const f = formatoExcel(c);
      if (f) celda.numFmt = f;
      celda.alignment = { vertical: "top", horizontal: c.tipo === "texto" ? "left" : "right", wrapText: c.tipo === "texto" };
      celda.border = { bottom: { style: "hair", color: { argb: COLOR.arena } } };
    });
  });

  ws.views = [{ state: "frozen", ySplit: encabezado, xSplit: 0 }];
  if (d.resultado.filas.length > 0) ws.autoFilter = { from: { row: encabezado, column: 1 }, to: { row: encabezado, column: cols.length } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.headerFooter = { oddFooter: "&L&A&RPágina &P de &N" };

  if (d.resultado.indicadores.length > 0 || d.resultado.notas.length > 0) {
    const hi = wb.addWorksheet("Indicadores");
    hi.columns = [{ width: 40 }, { width: 18 }, { width: 44 }];
    hi.getCell(1, 1).value = d.def.titulo;
    hi.getCell(1, 1).font = { name: FUENTE, size: 14, bold: true, color: { argb: COLOR.musgo } };
    hi.getRow(3).values = ["Indicador", "Valor", "Detalle"];
    hi.getRow(3).eachCell((celda) => {
      celda.font = { name: FUENTE, bold: true, color: { argb: COLOR.blanco } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.musgo } };
    });
    d.resultado.indicadores.forEach((ind, k) => {
      const fila = hi.getRow(4 + k);
      fila.values = [ind.etiqueta, ind.valor, ind.detalle ?? ""];
      fila.getCell(2).alignment = { horizontal: "right" };
      fila.eachCell((celda) => (celda.border = { bottom: { style: "hair", color: { argb: COLOR.arena } } }));
    });
    d.resultado.notas.forEach((nota, k) => {
      const fila = 5 + d.resultado.indicadores.length + k;
      hi.mergeCells(fila, 1, fila, 3);
      hi.getCell(fila, 1).value = nota;
      hi.getCell(fila, 1).font = { name: FUENTE, italic: true, color: { argb: "FF6B6457" } };
      hi.getCell(fila, 1).alignment = { wrapText: true, vertical: "top" };
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** «<finca> - <reporte> - <fecha>.xlsx», sin caracteres que un sistema de archivos rechace. */
export function nombreArchivoReporte(finca: string, titulo: string, hoy: string): string {
  const limpio = (t: string) => t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return `${limpio(finca)} - ${limpio(titulo)} - ${hoy}.xlsx`;
}
