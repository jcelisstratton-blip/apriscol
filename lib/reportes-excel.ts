import ExcelJS from "exceljs";
import { COLOR, FMT } from "@/lib/excel-estilo";
import { ETIQUETA_GRUPO_COSTO, ETIQUETA_ORIGEN, ETIQUETA_RUBRO, GRUPOS_COSTO, grupoDe } from "@/lib/costos";
import { ETIQUETA_LINEA, ETIQUETA_ORIGEN_VENTA, LINEAS } from "@/lib/ventas";
import { REPORTES, type ReporteId } from "@/lib/costos-reportes";
import type { LineaVenta, OrigenCosto, RubroCosto, RubroGasto, VentaLinea } from "@/lib/tipos";

// ───────────────────────── Datos que llegan ya consultados ─────────────────────────
export type FilaRubro = { rubro: RubroCosto; total: number; por_pagar: number; de_gastos: number; de_sanidad: number; de_ceba: number; movimientos: number };
export type FilaMes = { mes: string; costos: number; ingresos_leche: number; ingresos_animales: number; litros: number };
export type FilaDetalle = {
  fecha: string;
  origen: OrigenCosto;
  rubro: RubroCosto;
  descripcion: string;
  proveedor: string | null;
  cargado_a: string;
  estado: "Pagado" | "Por pagar" | "Vencido";
  vence: string | null;
  monto: number;
};
export type FilaAnimal = { numero_arete: string; nombre: string | null; especie: string; sexo: string; estado: string; directo: number; repartido: number; total: number; valor_compra: number | null };
export type FilaPendiente = { fecha: string; vence: string | null; atraso: number; proveedor: string | null; descripcion: string; rubro: RubroGasto; monto: number };
export type Indicadores = { total_costos: number; por_pagar: number; vencido: number; ingresos_leche: number; ingresos_animales: number; litros: number; animales_activos: number };
export type FilaVentaLinea = { linea: LineaVenta; total: number; por_cobrar: number; vencido: number; movimientos: number };
export type FilaDepreciacion = { tipo: "saca" | "mortalidad"; animales: number; con_valor: number; perdida: number };

export type DatosReporte = {
  finca: string;
  /** Primera y última fecha del periodo, en AAAA-MM-DD (para el título y el nombre del archivo). */
  desde: string;
  hasta: string;
  /** Cómo se eligió el periodo: «Este año», «Entre fechas»… */
  periodoTexto: string;
  filtros: string[];
  generado: Date;
  rubros?: FilaRubro[];
  meses?: FilaMes[];
  detalle?: FilaDetalle[];
  /** Gastos de toda la finca (no se reparten a los animales): se muestran aparte en «Costo por animal». */
  generalesFinca?: number;
  animales?: FilaAnimal[];
  pendientes?: FilaPendiente[];
  indicadores?: Indicadores;
  depreciacion?: FilaDepreciacion[];
  /** Lo vendido por línea de ingreso, y cada venta una por una. */
  ventasLinea?: FilaVentaLinea[];
  ventas?: VentaLinea[];
};

// ───────────────────────── Estilo ─────────────────────────
const FMT_PESOS = FMT.pesos;
const FMT_FECHA = FMT.fecha;
const FMT_LITROS = FMT.litros;
const FMT_PCT = FMT.porcentaje;

const aFecha = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const textoFecha = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};
const mesTexto = (iso: string) => {
  const [a, m] = iso.split("-").map(Number);
  return `${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m - 1]} ${a}`;
};

type Col = { titulo: string; ancho: number; formato?: string; alinear?: "left" | "right" | "center" };

/** Las cinco filas del título (finca, reporte, periodo, filtros, fecha de generación) y la fila de encabezados; devuelve la primera fila de datos. */
function encabezado(ws: ExcelJS.Worksheet, d: DatosReporte, titulo: string, cols: Col[]): number {
  const n = cols.length;
  ws.columns = cols.map((c) => ({ width: c.ancho }));
  const linea = (fila: number, texto: string, opciones: { size?: number; bold?: boolean; color?: string } = {}) => {
    ws.mergeCells(fila, 1, fila, n);
    const celda = ws.getCell(fila, 1);
    celda.value = texto;
    celda.font = { name: "Calibri", size: opciones.size ?? 11, bold: opciones.bold ?? false, color: { argb: opciones.color ?? "FF1F1B16" } };
    celda.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  };
  linea(1, d.finca, { size: 16, bold: true, color: COLOR.musgo });
  linea(2, titulo, { size: 13, bold: true });
  linea(3, `Periodo: del ${textoFecha(d.desde)} al ${textoFecha(d.hasta)} (${d.periodoTexto})`);
  linea(4, d.filtros.length > 0 ? `Filtros: ${d.filtros.join(" · ")}` : "Filtros: ninguno");
  linea(5, `Generado el ${textoFecha(d.generado.toISOString().slice(0, 10))}`, { color: "FF6B6457" });
  ws.getRow(1).height = 24;
  const fila = 7;
  const r = ws.getRow(fila);
  cols.forEach((c, i) => {
    const celda = r.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.musgo } };
    celda.alignment = { vertical: "middle", horizontal: c.alinear ?? (c.formato ? "right" : "left"), wrapText: true };
  });
  r.height = 30;
  ws.views = [{ state: "frozen", ySplit: fila, xSplit: 0 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.headerFooter = { oddFooter: "&L&A&RPágina &P de &N" };
  return fila + 1;
}

/** Pone una fila de datos con el formato de cada columna y las rayas suaves entre filas. */
function filaDatos(ws: ExcelJS.Worksheet, fila: number, cols: Col[], valores: (string | number | Date | null | { formula: string })[]) {
  const r = ws.getRow(fila);
  valores.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v as ExcelJS.CellValue;
    if (cols[i].formato) c.numFmt = cols[i].formato!;
    c.alignment = { vertical: "top", horizontal: cols[i].alinear ?? (cols[i].formato && !(v instanceof Date) ? "right" : "left"), wrapText: !cols[i].formato };
    c.border = { bottom: { style: "hair", color: { argb: COLOR.arena } } };
  });
}

/** La fila de totales: negrita, fondo de lana y fórmulas SUM sobre las columnas indicadas (se recalculan si se edita el archivo). */
function filaTotales(ws: ExcelJS.Worksheet, fila: number, primera: number, ultima: number, cols: Col[], sumar: number[], etiqueta = "Total") {
  const r = ws.getRow(fila);
  r.getCell(1).value = etiqueta;
  cols.forEach((c, i) => {
    const celda = r.getCell(i + 1);
    if (sumar.includes(i) && ultima >= primera) {
      const letra = ws.getColumn(i + 1).letter;
      celda.value = { formula: `SUM(${letra}${primera}:${letra}${ultima})` };
      if (c.formato) celda.numFmt = c.formato;
    }
    celda.font = { name: "Calibri", bold: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.lana } };
    celda.border = { top: { style: "thin", color: { argb: COLOR.musgo } } };
  });
}

function autofiltro(ws: ExcelJS.Worksheet, filaEncabezado: number, n: number) {
  ws.autoFilter = { from: { row: filaEncabezado, column: 1 }, to: { row: filaEncabezado, column: n } };
}

// ───────────────────────── Reportes ─────────────────────────
function hojaRubros(wb: ExcelJS.Workbook, d: DatosReporte, nombre = "Costos por rubro", titulo = "Costos por rubro") {
  const ws = wb.addWorksheet(nombre);
  const cols: Col[] = [
    { titulo: "Grupo", ancho: 26 }, { titulo: "Rubro", ancho: 30 },
    { titulo: "Compras registradas", ancho: 18, formato: FMT_PESOS }, { titulo: "Tratamientos (Sanidad)", ancho: 18, formato: FMT_PESOS }, { titulo: "Alimento de ceba", ancho: 18, formato: FMT_PESOS },
    { titulo: "Animales comprados y personal", ancho: 18, formato: FMT_PESOS },
    { titulo: "Total", ancho: 18, formato: FMT_PESOS }, { titulo: "% del total", ancho: 12, formato: FMT_PCT }, { titulo: "Por pagar", ancho: 16, formato: FMT_PESOS }, { titulo: "Movimientos", ancho: 13, formato: "0" },
  ];
  const inicio = encabezado(ws, d, titulo, cols);
  const filas = [...(d.rubros ?? [])].sort((a, b) => GRUPOS_COSTO.indexOf(grupoDe(a.rubro)) - GRUPOS_COSTO.indexOf(grupoDe(b.rubro)) || b.total - a.total);
  const ultima = inicio + filas.length - 1;
  const filaTotal = ultima + 1;
  filas.forEach((f, i) => {
    const fila = inicio + i;
    // Lo que no viene de compras, de sanidad ni de ceba es la compra de animales o los pagos al personal (nómina): sale de restar al total.
    const animales = Math.max(0, f.total - f.de_gastos - f.de_sanidad - f.de_ceba);
    filaDatos(ws, fila, cols, [ETIQUETA_GRUPO_COSTO[grupoDe(f.rubro)], ETIQUETA_RUBRO[f.rubro], f.de_gastos, f.de_sanidad, f.de_ceba, animales, { formula: `C${fila}+D${fila}+E${fila}+F${fila}` }, { formula: `IF(G$${filaTotal}>0,G${fila}/G$${filaTotal},0)` }, f.por_pagar, f.movimientos]);
  });
  filaTotales(ws, filaTotal, inicio, ultima, cols, [2, 3, 4, 5, 6, 8, 9]);
  ws.getCell(filaTotal, 8).value = { formula: `IF(G${filaTotal}>0,SUM(H${inicio}:H${ultima}),0)` };
  ws.getCell(filaTotal, 8).numFmt = FMT_PCT;
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "No hay costos en este periodo.";
}

function hojaMeses(wb: ExcelJS.Workbook, d: DatosReporte, nombre = "Por mes", titulo = "Costos y ventas por mes") {
  const ws = wb.addWorksheet(nombre);
  const cols: Col[] = [
    { titulo: "Mes", ancho: 20 }, { titulo: "Costos", ancho: 18, formato: FMT_PESOS }, { titulo: "Ventas de leche", ancho: 18, formato: FMT_PESOS }, { titulo: "Otras ventas", ancho: 20, formato: FMT_PESOS },
    { titulo: "Total ventas", ancho: 18, formato: FMT_PESOS }, { titulo: "Resultado", ancho: 18, formato: FMT_PESOS }, { titulo: "Litros producidos", ancho: 16, formato: FMT_LITROS }, { titulo: "Costo por litro", ancho: 16, formato: FMT_PESOS },
  ];
  const inicio = encabezado(ws, d, titulo, cols);
  const filas = d.meses ?? [];
  const ultima = inicio + filas.length - 1;
  filas.forEach((f, i) => {
    const fila = inicio + i;
    filaDatos(ws, fila, cols, [mesTexto(f.mes), f.costos, f.ingresos_leche, f.ingresos_animales, { formula: `C${fila}+D${fila}` }, { formula: `E${fila}-B${fila}` }, f.litros, { formula: `IF(G${fila}>0,B${fila}/G${fila},"")` }]);
  });
  const filaTotal = ultima + 1;
  filaTotales(ws, filaTotal, inicio, ultima, cols, [1, 2, 3, 4, 5, 6]);
  ws.getCell(filaTotal, 8).value = { formula: `IF(G${filaTotal}>0,B${filaTotal}/G${filaTotal},"")` };
  ws.getCell(filaTotal, 8).numFmt = FMT_PESOS;
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "No hay movimientos en este periodo.";
}

function hojaDetalle(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet("Detalle de compras");
  const cols: Col[] = [
    { titulo: "Fecha", ancho: 12, formato: FMT_FECHA, alinear: "left" }, { titulo: "Origen", ancho: 11 }, { titulo: "Grupo", ancho: 24 }, { titulo: "Rubro", ancho: 28 },
    { titulo: "Descripción", ancho: 40 }, { titulo: "Proveedor", ancho: 26 }, { titulo: "Se cargó a", ancho: 28 }, { titulo: "Estado de pago", ancho: 14 }, { titulo: "Vence", ancho: 12, formato: FMT_FECHA, alinear: "left" }, { titulo: "Valor", ancho: 16, formato: FMT_PESOS },
  ];
  const inicio = encabezado(ws, d, "Detalle de compras", cols);
  const filas = d.detalle ?? [];
  filas.forEach((f, i) => filaDatos(ws, inicio + i, cols, [aFecha(f.fecha), ETIQUETA_ORIGEN[f.origen], ETIQUETA_GRUPO_COSTO[grupoDe(f.rubro)], ETIQUETA_RUBRO[f.rubro], f.descripcion, f.proveedor ?? "", f.cargado_a, f.estado, aFecha(f.vence), f.monto]));
  const ultima = inicio + filas.length - 1;
  filaTotales(ws, ultima + 1, inicio, ultima, cols, [9]);
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "No hay compras en este periodo.";
}

function hojaAnimales(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet("Costo por animal");
  const cols: Col[] = [
    { titulo: "Arete", ancho: 16 }, { titulo: "Nombre", ancho: 22 }, { titulo: "Especie", ancho: 11 }, { titulo: "Sexo", ancho: 9 }, { titulo: "Estado", ancho: 11 },
    { titulo: "Costo directo", ancho: 16, formato: FMT_PESOS }, { titulo: "Costo repartido", ancho: 16, formato: FMT_PESOS }, { titulo: "Costo total", ancho: 16, formato: FMT_PESOS }, { titulo: "Valor de compra", ancho: 16, formato: FMT_PESOS },
  ];
  const inicio = encabezado(ws, d, "Costo por animal", cols);
  const filas = d.animales ?? [];
  filas.forEach((f, i) => {
    const fila = inicio + i;
    filaDatos(ws, fila, cols, [f.numero_arete, f.nombre ?? "", f.especie === "caprino" ? "Cabra" : "Oveja", f.sexo === "hembra" ? "Hembra" : "Macho", f.estado === "activo" ? "Activo" : "Fuera del hato", f.directo, f.repartido, { formula: `F${fila}+G${fila}` }, f.valor_compra]);
  });
  const ultima = inicio + filas.length - 1;
  filaTotales(ws, ultima + 1, inicio, ultima, cols, [5, 6, 7], "Total de los animales");
  const nota = ultima + 3;
  ws.mergeCells(nota, 1, nota, cols.length);
  ws.getCell(nota, 1).value = `Gastos generales de la finca, que no se reparten a los animales: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(d.generalesFinca ?? 0)}.`;
  ws.getCell(nota, 1).font = { italic: true, color: { argb: "FF6B6457" } };
  ws.mergeCells(nota + 1, 1, nota + 1, cols.length);
  ws.getCell(nota + 1, 1).value = "Costo directo: gastos cargados al animal y su parte de cada tratamiento. Costo repartido: su parte de lo cargado a su lote, su corral o su especie.";
  ws.getCell(nota + 1, 1).font = { italic: true, color: { argb: "FF6B6457" } };
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "Ningún animal tiene costos en este periodo.";
}

function hojaPendientes(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet("Gastos por pagar");
  const cols: Col[] = [
    { titulo: "Fecha del gasto", ancho: 14, formato: FMT_FECHA, alinear: "left" }, { titulo: "Vence", ancho: 12, formato: FMT_FECHA, alinear: "left" }, { titulo: "Días de atraso", ancho: 13, formato: "0" },
    { titulo: "Proveedor", ancho: 28 }, { titulo: "Descripción", ancho: 40 }, { titulo: "Rubro", ancho: 28 }, { titulo: "Valor", ancho: 16, formato: FMT_PESOS },
  ];
  const inicio = encabezado(ws, d, "Gastos por pagar", cols);
  const filas = d.pendientes ?? [];
  filas.forEach((f, i) => filaDatos(ws, inicio + i, cols, [aFecha(f.fecha), aFecha(f.vence), f.atraso > 0 ? f.atraso : 0, f.proveedor ?? "", f.descripcion, ETIQUETA_RUBRO[f.rubro], f.monto]));
  const ultima = inicio + filas.length - 1;
  filaTotales(ws, ultima + 1, inicio, ultima, cols, [6]);
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "No hay gastos por pagar en este periodo.";
}

function hojaVentas(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet("Ventas");
  const cols: Col[] = [
    { titulo: "Fecha", ancho: 12, formato: FMT_FECHA, alinear: "left" }, { titulo: "Origen", ancho: 18 }, { titulo: "Línea", ancho: 22 }, { titulo: "Producto", ancho: 32 },
    { titulo: "Comprador", ancho: 28 }, { titulo: "Cantidad", ancho: 12, formato: "#,##0.##" }, { titulo: "Unidad", ancho: 10 }, { titulo: "Estado de cobro", ancho: 15 }, { titulo: "Se espera", ancho: 12, formato: FMT_FECHA, alinear: "left" }, { titulo: "Valor", ancho: 16, formato: FMT_PESOS },
  ];
  const inicio = encabezado(ws, d, "Ventas", cols);
  const filas = d.ventas ?? [];
  filas.forEach((f, i) =>
    filaDatos(ws, inicio + i, cols, [aFecha(f.fecha), ETIQUETA_ORIGEN_VENTA[f.origen], ETIQUETA_LINEA[f.linea], f.producto, f.tercero ?? "", Number(f.cantidad), f.unidad ?? "", f.cobrado ? "Cobrado" : f.cobro_vence && f.cobro_vence < textoHoy(d) ? "Vencido" : "Por cobrar", aFecha(f.cobro_vence), Number(f.valor)]),
  );
  const ultima = inicio + filas.length - 1;
  filaTotales(ws, ultima + 1, inicio, ultima, cols, [9]);
  autofiltro(ws, inicio - 1, cols.length);
  if (filas.length === 0) ws.getCell(inicio, 1).value = "No hay ventas en este periodo.";
}

/** La fecha de hoy en AAAA-MM-DD, la del momento en que se generó el reporte (para saber qué cobros están vencidos). */
const textoHoy = (d: DatosReporte) => d.generado.toISOString().slice(0, 10);

function hojaResultado(wb: ExcelJS.Workbook, d: DatosReporte) {
  const ws = wb.addWorksheet("Resultado");
  const cols: Col[] = [{ titulo: "Concepto", ancho: 46 }, { titulo: "Valor", ancho: 20, formato: FMT_PESOS }, { titulo: "Nota", ancho: 54 }];
  const inicio = encabezado(ws, d, "Resultado del periodo", cols);
  const i = d.indicadores;
  const moneda = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  const sec = (fila: number, texto: string) => {
    ws.mergeCells(fila, 1, fila, 3);
    const c = ws.getCell(fila, 1);
    c.value = texto;
    c.font = { bold: true, color: { argb: COLOR.musgo } };
    c.border = { bottom: { style: "thin", color: { argb: COLOR.musgo } } };
  };
  let f = inicio;

  // Lo que se vendió, por línea.
  sec(f++, "Ventas");
  const desdeVentas = f;
  const porLinea = new Map((d.ventasLinea ?? []).map((l) => [l.linea, l]));
  for (const l of LINEAS) filaDatos(ws, f++, cols, [ETIQUETA_LINEA[l], porLinea.get(l)?.total ?? 0, porLinea.get(l)?.por_cobrar ? `Por cobrar: ${moneda(porLinea.get(l)!.por_cobrar)}` : ""]);
  const filaVentas = f++;
  filaDatos(ws, filaVentas, cols, ["Total ventas", { formula: `SUM(B${desdeVentas}:B${filaVentas - 1})` }, "Leche despachada, animales vendidos y demás ventas"]);
  ws.getRow(filaVentas).font = { bold: true };
  f++;

  // Lo que costó: las compras por grupo, la mano de obra y el total.
  const porGrupo = new Map<string, number>();
  for (const r of d.rubros ?? []) porGrupo.set(grupoDe(r.rubro), (porGrupo.get(grupoDe(r.rubro)) ?? 0) + r.total);
  sec(f++, "Compras");
  const desdeCompras = f;
  for (const g of GRUPOS_COSTO.filter((x) => x !== "personal")) filaDatos(ws, f++, cols, [ETIQUETA_GRUPO_COSTO[g], porGrupo.get(g) ?? 0, ""]);
  const filaCompras = f++;
  filaDatos(ws, filaCompras, cols, ["Total compras", { formula: `SUM(B${desdeCompras}:B${filaCompras - 1})` }, "Compras registradas, tratamientos, alimento de ceba y animales comprados"]);
  ws.getRow(filaCompras).font = { bold: true };
  f++;
  sec(f++, "Mano de obra");
  const filaMano = f++;
  filaDatos(ws, filaMano, cols, ["Total mano de obra", porGrupo.get("personal") ?? 0, "Jornales, salarios y honorarios"]);
  ws.getRow(filaMano).font = { bold: true };
  f++;
  const filaCostos = f++;
  filaDatos(ws, filaCostos, cols, ["Total costos", { formula: `B${filaCompras}+B${filaMano}` }, "Compras más mano de obra"]);
  ws.getRow(filaCostos).font = { bold: true };
  f++;

  sec(f++, "Resultado");
  const filaRes = f++;
  filaDatos(ws, filaRes, cols, ["Ventas menos costos", { formula: `B${filaVentas}-B${filaCostos}` }, "Positivo: el periodo dejó ganancia"]);
  ws.getRow(filaRes).font = { bold: true };
  const filaL = f++;
  filaDatos(ws, filaL, cols, ["Litros producidos", i?.litros ?? 0, "Suma de los ordeños registrados"]);
  ws.getCell(filaL, 2).numFmt = FMT_LITROS;
  const filaCL = f++;
  filaDatos(ws, filaCL, cols, ["Costo por litro", { formula: `IF(B${filaL}>0,B${filaCostos}/B${filaL},"")` }, "Costo total del periodo entre los litros producidos"]);
  filaDatos(ws, f++, cols, ["Costo por animal activo", { formula: `IF(${i?.animales_activos ?? 0}>0,B${filaCostos}/${i?.animales_activos ?? 0},"")` }, `Entre los ${i?.animales_activos ?? 0} animales activos de hoy`]);
  filaDatos(ws, f++, cols, ["Compras por pagar", i?.por_pagar ?? 0, `De ellas, ${moneda(i?.vencido ?? 0)} ya vencieron`]);
  const porCobrar = (d.ventasLinea ?? []).reduce((a, l) => a + l.por_cobrar, 0);
  const cobroVencido = (d.ventasLinea ?? []).reduce((a, l) => a + l.vencido, 0);
  filaDatos(ws, f++, cols, ["Ventas por cobrar", porCobrar, `De ellas, ${moneda(cobroVencido)} ya pasaron la fecha esperada`]);
  f++;
  sec(f++, "Pérdida por saca y mortalidad");
  for (const x of d.depreciacion ?? []) {
    filaDatos(ws, f++, cols, [x.tipo === "saca" ? "Saca (descarte vendido por debajo de su costo)" : "Mortalidad (animales muertos o perdidos)", x.perdida, `${x.animales} animales; ${x.con_valor} con valor de compra registrado${x.con_valor < x.animales ? ": la cifra está incompleta" : ""}`]);
  }
  hojaMeses(wb, d, "Por mes", "Costos y ventas por mes");
}

/** El libro de Excel de un reporte: una hoja con el título (finca, reporte, periodo y filtros), la tabla y los totales como fórmulas. */
export async function construirLibro(reporte: ReporteId, d: DatosReporte): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const info = REPORTES.find((r) => r.id === reporte);
  wb.creator = "Apriscol";
  wb.created = d.generado;
  wb.title = `${d.finca} - ${info?.titulo ?? "Reporte"} - ${d.desde} a ${d.hasta}`;
  switch (reporte) {
    case "rubros":
      hojaRubros(wb, d);
      break;
    case "meses":
      hojaMeses(wb, d);
      break;
    case "detalle":
      hojaDetalle(wb, d);
      break;
    case "ventas":
      hojaVentas(wb, d);
      break;
    case "animales":
      hojaAnimales(wb, d);
      break;
    case "pendientes":
      hojaPendientes(wb, d);
      break;
    case "resultado":
      hojaResultado(wb, d);
      break;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** El nombre del archivo: finca, reporte y fechas («La yulianca - Gastos por rubro - 2026-01-01 a 2026-10-13.xlsx»), sin caracteres que un sistema de archivos rechace. */
export function nombreArchivo(finca: string, reporte: ReporteId, desde: string, hasta: string): string {
  const titulo = REPORTES.find((r) => r.id === reporte)?.titulo ?? "Reporte";
  const limpio = (t: string) => t.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return `${limpio(finca)} - ${titulo} - ${desde} a ${hasta}.xlsx`;
}
