import ExcelJS from "exceljs";
import { COLOR, FMT, escribirEncabezados, escribirTitulo, limpiarNombreArchivo, textoFecha } from "@/lib/excel-estilo";
import type { BaseProyeccion } from "@/lib/proyeccion/base";
import type { Bloque, Proyeccion } from "@/lib/proyeccion/motor";
import { DEFINICIONES, ETIQUETA_GRUPO_SUPUESTO, ETIQUETA_ORIGEN, type Ajustes, type Supuestos } from "@/lib/proyeccion/supuestos";
import { columnasAlimento, columnasDinero, columnasHato, etiquetaMes, lineasResumen, type ColumnaMes, type Enfoque, type Formato } from "@/lib/proyeccion/vista";

export type DatosLibroProyeccion = {
  finca: string;
  hoy: string;
  generado: Date;
  horizonte: number;
  proyeccion: Proyeccion;
  bloques: Bloque[];
  supuestos: Supuestos;
  ajustes: Ajustes;
  procedencia: BaseProyeccion["procedencia"];
};

const FORMATO_EXCEL: Record<Formato, string> = { n0: "#,##0", n1: "#,##0.0", pesos: FMT.pesos, ton: "#,##0.00" };
const UNIDAD: Record<string, string> = { n: "", pct: "%", meses: "meses", kg: "kg", pesos: "$", litros: "litros", kg_ms: "kg de materia seca al día" };

export const nombreArchivoProyeccion = (finca: string, hoy: string) => limpiarNombreArchivo(`${finca} - Proyecciones - ${hoy}.xlsx`);

/** El Excel de una proyección: resumen por año (todo, carne y leche), el mes a mes completo y los supuestos con su origen. Son los mismos números de la pantalla. */
export async function construirLibroProyeccion(d: DatosLibroProyeccion): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Apriscol";
  wb.created = d.generado;

  const titulo = (ws: ExcelJS.Worksheet, columnas: number, subtitulo: string) =>
    escribirTitulo(ws, columnas, [
      { texto: d.finca, size: 16, bold: true, color: COLOR.musgo },
      { texto: subtitulo, size: 12, bold: true },
      { texto: `${d.horizonte} meses desde ${textoFecha(d.hoy)} · generado el ${textoFecha(d.hoy)}`, color: COLOR.humo },
      { texto: "Es una estimación con los números de la hoja «Supuestos»; no es una promesa de resultados.", color: COLOR.humo },
    ]);

  // 1. Resumen por año
  const resumen = wb.addWorksheet("Resumen por año");
  const columnasResumen = 1 + d.bloques.length;
  titulo(resumen, columnasResumen, "Resumen por año");
  let fila = 6;
  for (const enfoque of ["todo", "carne", "leche"] as Enfoque[]) {
    resumen.mergeCells(fila, 1, fila, columnasResumen);
    const t = resumen.getCell(fila, 1);
    t.value = enfoque === "todo" ? "Carne y leche juntas" : enfoque === "carne" ? "Solo carne" : "Solo leche";
    t.font = { bold: true, size: 12, color: { argb: COLOR.musgo } };
    fila += 1;
    escribirEncabezados(resumen, fila, [{ titulo: "", derecha: false }, ...d.bloques.map((b) => ({ titulo: `${b.etiqueta} (${etiquetaMes(d.hoy, b.desde)} a ${etiquetaMes(d.hoy, b.hasta)})`, derecha: true }))], 32);
    resumen.views = [];
    fila += 1;
    for (const l of lineasResumen(enfoque)) {
      resumen.getCell(fila, 1).value = l.titulo;
      if (l.destacada) resumen.getRow(fila).font = { bold: true };
      d.bloques.forEach((b, i) => {
        const celda = resumen.getCell(fila, i + 2);
        celda.value = Math.round(l.valor(b) * 100) / 100;
        celda.numFmt = FORMATO_EXCEL[l.formato];
      });
      fila += 1;
    }
    fila += 1;
  }
  resumen.getColumn(1).width = 44;
  for (let i = 2; i <= columnasResumen; i++) resumen.getColumn(i).width = 26;

  // 2. Mes a mes (hato, alimento y dinero en una sola hoja)
  const columnas: { grupo: string; col: ColumnaMes }[] = [
    ...columnasHato("todo").map((col) => ({ grupo: "Hato", col })),
    ...columnasAlimento("todo").map((col) => ({ grupo: "Alimento", col })),
    ...columnasDinero("todo").map((col) => ({ grupo: "Dinero", col })),
    { grupo: "Leche", col: { clave: "litros", titulo: "Litros del mes", formato: "n0", valor: (m) => m.litros, suma: true } },
    { grupo: "Leche", col: { clave: "lactantes", titulo: "Hembras en lactancia", formato: "n0", valor: (m) => m.lactantes, suma: false } },
  ];
  const meses = wb.addWorksheet("Mes a mes");
  titulo(meses, columnas.length + 1, "Mes a mes");
  escribirEncabezados(meses, 6, [{ titulo: "Mes", derecha: false }, ...columnas.map((c) => ({ titulo: `${c.grupo}: ${c.col.titulo}`, derecha: true }))], 48);
  meses.views = [{ state: "frozen", ySplit: 6, xSplit: 1 }];
  d.proyeccion.meses.forEach((m, i) => {
    const r = meses.getRow(7 + i);
    r.getCell(1).value = `${m.n} · ${etiquetaMes(d.hoy, m.n)}`;
    columnas.forEach((c, j) => {
      const celda = r.getCell(j + 2);
      celda.value = Math.round(c.col.valor(m) * 100) / 100;
      celda.numFmt = FORMATO_EXCEL[c.col.formato];
    });
  });
  meses.getColumn(1).width = 16;
  for (let j = 0; j < columnas.length; j++) meses.getColumn(j + 2).width = 18;

  // 3. Supuestos con su origen
  const sup = wb.addWorksheet("Supuestos");
  titulo(sup, 5, "Supuestos");
  escribirEncabezados(sup, 6, [{ titulo: "Grupo", derecha: false }, { titulo: "Supuesto", derecha: false }, { titulo: "Valor", derecha: true }, { titulo: "Unidad", derecha: false }, { titulo: "De dónde sale", derecha: false }]);
  DEFINICIONES.forEach((def, i) => {
    const r = sup.getRow(7 + i);
    const origen = def.clave in d.ajustes ? "ajuste" : d.procedencia[def.clave].origen;
    r.getCell(1).value = ETIQUETA_GRUPO_SUPUESTO[def.grupo];
    r.getCell(2).value = def.etiqueta;
    const v = r.getCell(3);
    v.value = d.supuestos[def.clave];
    v.numFmt = def.unidad === "pesos" ? FMT.pesos : def.decimales > 0 ? `#,##0.${"0".repeat(def.decimales)}` : "#,##0";
    r.getCell(4).value = UNIDAD[def.unidad];
    const muestra = origen === "finca" ? d.procedencia[def.clave].muestra : undefined;
    r.getCell(5).value = muestra ? `${ETIQUETA_ORIGEN[origen]} · ${muestra}` : ETIQUETA_ORIGEN[origen];
  });
  [22, 52, 18, 26, 44].forEach((w, i) => (sup.getColumn(i + 1).width = w));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
