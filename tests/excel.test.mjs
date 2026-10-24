// Los dos Excel de reportes (costos y los de la finca) comparten encabezado, fechas y nombre de archivo.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { construirLibro, nombreArchivo } from "../lib/reportes-excel.ts";
import { nombreArchivoFinca } from "../lib/exportar-finca.ts";
import { nombreArchivoReporte } from "../lib/reportes/excel.ts";

const base = { finca: "La Yulianca", desde: "2026-01-01", hasta: "2026-10-13", periodoTexto: "este año", filtros: ["Grupo: Alimentación"], generado: new Date("2026-10-24T12:00:00Z") };
const leer = async (buf) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
};

test("Excel de costos: título de cinco líneas, encabezados con color, fechas de verdad y fórmulas de total", async () => {
  const wb = await leer(await construirLibro("pendientes", { ...base, pendientes: [{ fecha: "2026-09-01", vence: "2026-09-30", atraso: 24, proveedor: "Agro", descripcion: "Concentrado", rubro: "alimento", monto: 120000 }, { fecha: "2026-10-01", vence: null, atraso: 0, proveedor: null, descripcion: "Sal", rubro: "alimento", monto: 30000 }] }));
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("A1").value, "La Yulianca");
  assert.match(ws.getCell("A3").value, /Periodo: del 01\/01\/2026 al 13\/10\/2026 \(este año\)/);
  assert.match(ws.getCell("A4").value, /Filtros: Grupo: Alimentación/);
  assert.match(ws.getCell("A5").value, /Generado el 24\/10\/2026/);
  const encabezado = ws.getRow(7).getCell(1);
  assert.ok(encabezado.value, "la fila 7 son los títulos de las columnas");
  assert.equal(encabezado.fill.fgColor.argb, "FF2F5A45");
  assert.equal(encabezado.font.bold, true);
  assert.ok(ws.getRow(8).getCell(1).value instanceof Date, "una fecha es una fecha, no un texto");
  assert.equal(ws.getRow(8).getCell(1).numFmt, "dd/mm/yyyy");
  assert.equal(ws.getRow(9).getCell(2).value, null, "sin fecha de vencimiento queda vacío");
  assert.equal(ws.views[0].ySplit, 7, "los títulos quedan fijos al desplazarse");
});

test("Excel de costos sin filtros dice «ninguno»", async () => {
  const wb = await leer(await construirLibro("pendientes", { ...base, filtros: [], pendientes: [] }));
  assert.equal(wb.worksheets[0].getCell("A4").value, "Filtros: ninguno");
});

test("nombre de archivo: sin caracteres que un sistema de archivos rechace, en los tres Excel", () => {
  assert.equal(nombreArchivo("Finca: La/Loma", "rubros", "2026-01-01", "2026-10-13"), "Finca- La-Loma - Costos por rubro - 2026-01-01 a 2026-10-13.xlsx");
  assert.equal(nombreArchivoReporte("Finca: La/Loma", "Partos del periodo", "2026-10-24"), "Finca- La-Loma - Partos del periodo - 2026-10-24.xlsx");
  assert.match(nombreArchivoFinca("Finca: La/Loma", "2026-10-24"), /^Finca- La-Loma/);
  assert.match(nombreArchivoFinca("///", "2026-10-24"), /^---/, "un nombre solo de símbolos no deja el archivo sin nombre");
});
