import ExcelJS from "exceljs";
import { COLOR, FMT, estiloEncabezado, relleno } from "@/lib/excel-estilo";
import {
  COLUMNAS,
  COLUMNAS_REPRODUCCION,
  COLUMNA_UBICACION,
  LISTA_TIPO_SERVICIO,
  MAX_FILAS_IMPORTAR,
  mapearEncabezados,
  type CeldaCruda,
  type ColumnaId,
  type Especie,
  type FilaCruda,
  type RazaRef,
  type UbicacionRef,
} from "@/lib/importar-animales";
import { MAX_VALORES_MAPEO, proponerMapeo, puntajeDeTitulo, type ColumnaArchivo } from "@/lib/importar-mapeo";


/** El valor útil de una celda de ExcelJS (fórmulas, texto con formato y enlaces incluidos). */
function valorCelda(v: ExcelJS.CellValue): CeldaCruda {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return valorCelda(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
  }
  return null;
}

export type LecturaArchivo =
  | { ok: true; filas: FilaCruda[] }
  | { ok: false; error: string };

const HOJAS_DE_AYUDA = ["instrucciones", "listas"];
const MAX_COLUMNAS_LEIDAS = 80;
const FILAS_PARA_ENCABEZADO = 15;

export type HojaInfo = { nombre: string; filas: number };

/** El valor de una celda como texto, para mostrarlo y para reconocer su contenido (las fechas de Excel salen como AAAA-MM-DD). */
function textoDeCelda(v: CeldaCruda): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
  return String(v).trim();
}

async function abrirLibro(buffer: ArrayBuffer): Promise<ExcelJS.Workbook | null> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
    return libro;
  } catch {
    return null;
  }
}

/** Las hojas con datos (sin las de ayuda de nuestra plantilla) y cuál usar: la pedida, «Animales» o la que más filas tenga. */
function elegirHoja(libro: ExcelJS.Workbook, pedida?: string): { hojas: HojaInfo[]; hoja: ExcelJS.Worksheet | null } {
  const candidatas = libro.worksheets.filter((h) => h.state !== "hidden" && h.state !== "veryHidden" && !HOJAS_DE_AYUDA.includes(h.name.trim().toLowerCase()));
  const hojas = candidatas.map((h) => ({ nombre: h.name, filas: h.actualRowCount }));
  const elegida =
    candidatas.find((h) => h.name === pedida) ??
    candidatas.find((h) => h.name.trim().toLowerCase() === "animales") ??
    [...candidatas].sort((a, b) => b.actualRowCount - a.actualRowCount)[0] ??
    null;
  return { hojas, hoja: elegida };
}

/** La fila de títulos: entre las primeras filas, la que más celdas tiene con nombre de campo reconocible (los cuadernos suelen traer un título arriba). */
function encontrarFilaDeEncabezados(hoja: ExcelJS.Worksheet): number {
  let mejor = { fila: 0, puntaje: -1 };
  const tope = Math.min(hoja.rowCount, FILAS_PARA_ENCABEZADO);
  for (let r = 1; r <= tope; r++) {
    const textos: string[] = [];
    hoja.getRow(r).eachCell({ includeEmpty: false }, (celda) => textos.push(textoDeCelda(valorCelda(celda.value))));
    const llenas = textos.filter((t) => t !== "");
    if (llenas.length < 2) continue;
    const puntaje = llenas.filter((t) => puntajeDeTitulo(t) > 0).length;
    if (puntaje > mejor.puntaje) mejor = { fila: r, puntaje };
  }
  return mejor.fila || 1;
}

export type AnalisisArchivo =
  | {
      ok: true;
      hojas: HojaInfo[];
      hoja: string;
      /** Fila (de Excel, desde 1) donde están los títulos. */
      filaEncabezado: number;
      columnas: ColumnaArchivo[];
      /** Filas con datos debajo de los títulos. */
      totalFilas: number;
      /** A qué campo corresponde cada columna, según la propuesta del asistente (en el orden de `columnas`). */
      propuesta: (ColumnaId | null)[];
    }
  | { ok: false; error: string };

/**
 * Abre el Excel de la persona (el que sea, no solo nuestra plantilla): elige la hoja, encuentra la fila de títulos, junta los valores de cada
 * columna y propone a qué campo corresponde cada una. No valida animales: eso lo hace `validarFilas` después de que la persona confirme las columnas.
 */
export async function analizarArchivo(buffer: ArrayBuffer, opciones: { hoja?: string; aretesDelHato?: string[] } = {}): Promise<AnalisisArchivo> {
  const libro = await abrirLibro(buffer);
  if (!libro) return { ok: false, error: "No se pudo abrir el archivo. Guárdalo como libro de Excel (.xlsx) y vuelve a subirlo." };
  const { hojas, hoja } = elegirHoja(libro, opciones.hoja);
  if (!hoja) return { ok: false, error: "El archivo no tiene hojas con datos." };

  const filaEncabezado = encontrarFilaDeEncabezados(hoja);
  const ultima = hoja.rowCount;
  const columnas: ColumnaArchivo[] = [];
  const totalColumnas = Math.min(hoja.columnCount, MAX_COLUMNAS_LEIDAS);
  let totalFilas = 0;
  for (let r = filaEncabezado + 1; r <= ultima; r++) {
    let hayDatos = false;
    hoja.getRow(r).eachCell({ includeEmpty: false }, (celda, col) => {
      if (col <= totalColumnas && textoDeCelda(valorCelda(celda.value)) !== "") hayDatos = true;
    });
    if (hayDatos) totalFilas++;
  }
  if (totalFilas === 0) return { ok: false, error: "No encontré animales debajo de los títulos. Escribe cada animal en una fila." };

  for (let c = 1; c <= totalColumnas; c++) {
    const titulo = textoDeCelda(valorCelda(hoja.getCell(filaEncabezado, c).value));
    const valores: string[] = [];
    for (let r = filaEncabezado + 1; r <= ultima && valores.length < MAX_VALORES_MAPEO; r++) {
      valores.push(textoDeCelda(valorCelda(hoja.getCell(r, c).value)));
    }
    if (titulo === "" && valores.every((v) => v === "")) continue;
    columnas.push({ indice: c - 1, encabezado: titulo || `Columna ${letra(c)}`, valores });
  }
  if (columnas.length === 0) return { ok: false, error: "No encontré columnas con datos en el archivo." };
  return { ok: true, hojas, hoja: hoja.name, filaEncabezado, columnas, totalFilas, propuesta: proponerMapeo(columnas, opciones.aretesDelHato ?? []) };
}

/** Qué campo recibe cada columna del archivo, por su posición en la hoja (0 = A). */
export type MapeoColumnas = { indice: number; campo: ColumnaId }[];

/** Lee las filas de animales de la hoja con las columnas que la persona confirmó. No valida las reglas del animal: eso lo hace `validarFilas`. */
export async function leerArchivoAnimales(buffer: ArrayBuffer, opciones: { hoja?: string; filaEncabezado?: number; mapeo?: MapeoColumnas } = {}): Promise<LecturaArchivo> {
  const libro = await abrirLibro(buffer);
  if (!libro) return { ok: false, error: "No se pudo abrir el archivo. Guárdalo como libro de Excel (.xlsx) y vuelve a subirlo." };
  const { hoja } = elegirHoja(libro, opciones.hoja);
  if (!hoja) return { ok: false, error: "El archivo no tiene hojas." };

  const filaEncabezado = opciones.filaEncabezado ?? encontrarFilaDeEncabezados(hoja);
  let mapeo = opciones.mapeo;
  if (!mapeo) {
    // Sin columnas confirmadas (archivo de nuestra plantilla): se reconocen por sus títulos.
    const encabezados: string[] = [];
    hoja.getRow(filaEncabezado).eachCell({ includeEmpty: true }, (celda, col) => {
      encabezados[col - 1] = textoDeCelda(valorCelda(celda.value));
    });
    const { columnas } = mapearEncabezados(encabezados);
    mapeo = columnas.flatMap((campo, indice) => (campo ? [{ indice, campo }] : []));
  }
  if (!mapeo.some((m) => m.campo === "numero_arete")) {
    return { ok: false, error: "Falta indicar cuál columna es el «Número de arete»: es lo que identifica a cada animal." };
  }

  const filas: FilaCruda[] = [];
  for (let r = filaEncabezado + 1; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const valores: Partial<Record<ColumnaId, CeldaCruda>> = {};
    let tieneDatos = false;
    for (const { indice, campo } of mapeo) {
      const v = valorCelda(fila.getCell(indice + 1).value);
      if (v === null || (typeof v === "string" && v.trim() === "")) continue;
      valores[campo] = v;
      tieneDatos = true;
    }
    if (!tieneDatos) continue;
    filas.push({ fila: r, valores });
    if (filas.length > MAX_FILAS_IMPORTAR) {
      return { ok: false, error: `El archivo tiene más de ${MAX_FILAS_IMPORTAR} animales. Divídelo en varios archivos de hasta ${MAX_FILAS_IMPORTAR}: puedes cargarlos uno tras otro.` };
    }
  }
  if (filas.length === 0) return { ok: false, error: "No encontré animales en el archivo. Escribe cada animal en una fila, debajo de los títulos." };
  return { ok: true, filas };
}

// ───────────────────────── La plantilla ─────────────────────────
const LISTA_ESPECIE = ["Caprino", "Ovino"];
const LISTA_SEXO = ["Hembra", "Macho"];
const LISTA_SI_NO = ["No", "Sí"];
const LISTA_ORIGEN = ["Nació en la finca", "Comprado"];
const LISTA_APTITUD = ["Leche", "Carne", "Doble"];
const LISTA_USO = ["Reproductor", "Carne", "Por definir"];

const letra = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/** Las columnas que esta finca puede usar: servicio y preñez si puede registrar reproducción; corral si puede asignar ubicaciones y ya creó alguna. */
export function columnasDePlantilla({ reproduccion, ubicaciones }: { reproduccion: boolean; ubicaciones?: UbicacionRef[] }) {
  return COLUMNAS.filter((c) => {
    if ((COLUMNAS_REPRODUCCION as readonly string[]).includes(c.id)) return reproduccion;
    if (c.id === COLUMNA_UBICACION) return !!ubicaciones && ubicaciones.length > 0;
    return true;
  });
}

export async function construirPlantillaAnimales({
  finca,
  especies,
  razas,
  reproduccion = false,
  ubicaciones,
}: {
  finca: string;
  especies: Especie[];
  razas: RazaRef[];
  reproduccion?: boolean;
  ubicaciones?: UbicacionRef[];
}): Promise<Buffer> {
  const columnas = columnasDePlantilla({ reproduccion, ubicaciones });
  const libro = new ExcelJS.Workbook();
  libro.creator = "Apriscol";
  libro.created = new Date();

  const hoja = libro.addWorksheet("Animales", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  const ayuda = libro.addWorksheet("Instrucciones");
  const listas = libro.addWorksheet("Listas");

  // Listas (de aquí salen los desplegables de la hoja Animales)
  const razasDe = (e: Especie) => razas.filter((r) => r.especie === e).map((r) => r.nombre);
  const columnasLista: { titulo: string; valores: string[] }[] = [
    { titulo: "Especie", valores: LISTA_ESPECIE.filter((e) => especies.includes(e.toLowerCase() as Especie)) },
    { titulo: "Sexo", valores: LISTA_SEXO },
    { titulo: "Sí o No", valores: LISTA_SI_NO },
    { titulo: "Origen", valores: LISTA_ORIGEN },
    { titulo: "Aptitud", valores: LISTA_APTITUD },
    { titulo: "Uso del macho", valores: LISTA_USO },
    { titulo: "Razas de cabras", valores: razasDe("caprino") },
    { titulo: "Razas de ovejas", valores: razasDe("ovino") },
    { titulo: "Tipo de servicio", valores: [...LISTA_TIPO_SERVICIO] },
    { titulo: "Corrales y potreros", valores: (ubicaciones ?? []).map((u) => u.nombre) },
  ];
  // Las razas se nombran para que el desplegable de «Raza» cambie según la especie de la fila.
  libro.definedNames.add(`Listas!$G$2:$G$${Math.max(2, columnasLista[6].valores.length + 1)}`, "Razas_Caprino");
  libro.definedNames.add(`Listas!$H$2:$H$${Math.max(2, columnasLista[7].valores.length + 1)}`, "Razas_Ovino");
  columnasLista.forEach((c, i) => {
    const col = listas.getColumn(i + 1);
    col.width = 22;
    listas.getCell(1, i + 1).value = c.titulo;
    listas.getCell(1, i + 1).font = { bold: true };
    c.valores.forEach((v, j) => (listas.getCell(j + 2, i + 1).value = v));
  });
  const rango = (i: number) => `Listas!$${letra(i + 1)}$2:$${letra(i + 1)}$${Math.max(2, columnasLista[i].valores.length + 1)}`;

  // Hoja Animales: títulos
  columnas.forEach((c, i) => {
    const celda = hoja.getCell(1, i + 1);
    celda.value = c.requerida ? `${c.titulo} *` : c.titulo;
    estiloEncabezado(celda, c.requerida ? COLOR.ocre : COLOR.musgo);
    celda.alignment = { vertical: "middle", wrapText: true };
    celda.note = c.ayuda;
    hoja.getColumn(i + 1).width = c.ancho;
  });
  hoja.getRow(1).height = 34;

  // Desplegables y formatos de las filas de captura
  const indice = (id: ColumnaId) => columnas.findIndex((c) => c.id === id) + 1;
  const existe = (id: ColumnaId) => indice(id) > 0;
  /** `formula` puede cambiar por fila (por ejemplo, la raza según la especie de esa fila). */
  const lista = (id: ColumnaId, formula: string | ((fila: number) => string), aviso: string) => {
    const col = indice(id);
    if (col === 0) return;
    for (let r = 2; r <= MAX_FILAS_IMPORTAR + 1; r++) {
      hoja.getCell(r, col).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [typeof formula === "string" ? formula : formula(r)],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Valor de la lista",
        error: aviso,
      };
    }
  };
  lista("especie", rango(0), "Elige Caprino u Ovino.");
  lista("sexo", rango(1), "Elige Hembra o Macho.");
  lista("nacimiento_aprox", rango(2), "Elige Sí o No.");
  lista("origen", rango(3), "Elige «Nació en la finca» o «Comprado».");
  lista("aptitud", rango(4), "Elige Leche, Carne o Doble.");
  lista("uso_macho", rango(5), "Elige Reproductor, Carne o Por definir.");
  lista("tipo_servicio", rango(8), "Elige Monta natural, Inseminación o Transferencia de embrión.");
  lista("prenez_confirmada", rango(2), "Elige Sí o No.");
  lista("ubicacion", rango(9), "Elige un corral o potrero de la lista (hoja «Listas»).");
  // La raza depende de la especie de la fila: una sola especie → su lista; las dos → la de la columna «Especie» (cabras si está vacía).
  if (especies.length === 1) lista("raza", rango(especies[0] === "caprino" ? 6 : 7), "Elige una raza de la lista (hoja «Listas»).");
  else if (existe("especie")) {
    const col = letra(indice("especie"));
    lista("raza", (r) => `INDIRECT(IF($${col}${r}="Ovino","Razas_Ovino","Razas_Caprino"))`, "Elige una raza de la lista (hoja «Listas»), de la misma especie del animal.");
  }
  for (const id of ["fecha_nacimiento", "fecha_ultimo_parto", "fecha_compra", "fecha_servicio"] as const) {
    if (!existe(id)) continue;
    for (let r = 2; r <= MAX_FILAS_IMPORTAR + 1; r++) hoja.getCell(r, indice(id)).numFmt = FMT.fecha;
  }
  // Arete, chip y valores de texto como texto: Excel no debe volver número ni quitar ceros a un arete como 00123.
  for (const id of ["numero_arete", "padre_arete", "madre_arete", "semental_arete", "chip"] as const) {
    if (!existe(id)) continue;
    for (let r = 2; r <= MAX_FILAS_IMPORTAR + 1; r++) hoja.getCell(r, indice(id)).numFmt = "@";
  }

  // Instrucciones
  ayuda.getColumn(1).width = 34;
  ayuda.getColumn(2).width = 92;
  const titulo = ayuda.getCell("A1");
  titulo.value = `Plantilla de animales · ${finca}`;
  titulo.font = { bold: true, size: 15, color: { argb: COLOR.musgo } };
  const pasos = [
    "1. Escribe un animal por fila en la hoja «Animales», debajo de los títulos. Las columnas con * son obligatorias.",
    "2. Para armar la genealogía, escribe el arete del padre y de la madre. Pueden ser animales de este mismo archivo o animales que ya están en tu hato.",
    "3. Si el padre o la madre no son animales tuyos, escribe su nombre en «Padre (si no está en tu hato)» o «Madre (si no está en tu hato)».",
    `4. Hasta ${MAX_FILAS_IMPORTAR} animales por archivo. Un arete que ya existe en tu finca se deja como está, o se completa o corrige: tú eliges al subir el archivo.`,
    "5. Guarda el archivo como .xlsx, súbelo en Apriscol y revisa la vista previa. Si hay errores te dice la fila y qué corregir; nada se guarda hasta que confirmes.",
    ...(reproduccion ? ["6. Hembras ya paridas: pon cuántos partos llevan y la fecha del último. Hembras servidas: la fecha del servicio (y Sí en «Preñez confirmada» si ya está confirmada); de ahí salen la fecha prevista de parto y el estado reproductivo. El servicio debe ser posterior al último parto."] : []),
    ...(ubicaciones && ubicaciones.length > 0 ? ["7. «Corral o potrero»: elige de la lista los que ya creaste en Hato → Corrales. Cada uno tiene su cupo: el archivo no puede pasarse."] : []),
  ];
  pasos.forEach((p, i) => {
    const c = ayuda.getCell(i + 3, 1);
    c.value = p;
    ayuda.mergeCells(i + 3, 1, i + 3, 2);
    c.alignment = { wrapText: true, vertical: "top" };
    ayuda.getRow(i + 3).height = 32;
  });
  const desde = pasos.length + 4;
  ayuda.getCell(desde, 1).value = "Columna";
  ayuda.getCell(desde, 2).value = "Qué poner";
  for (const c of [ayuda.getCell(desde, 1), ayuda.getCell(desde, 2)]) {
    estiloEncabezado(c);
  }
  columnas.forEach((c, i) => {
    const a = ayuda.getCell(desde + 1 + i, 1);
    const b = ayuda.getCell(desde + 1 + i, 2);
    a.value = c.requerida ? `${c.titulo} *` : c.titulo;
    a.font = { bold: c.requerida };
    b.value = c.ayuda;
    b.alignment = { wrapText: true, vertical: "top" };
    if (i % 2 === 0) for (const x of [a, b]) x.fill = relleno(COLOR.lana);
  });

  const ejemplo = desde + columnas.length + 3;
  ayuda.getCell(ejemplo, 1).value = "Ejemplo de genealogía";
  ayuda.getCell(ejemplo, 1).font = { bold: true, color: { argb: COLOR.musgo } };
  const filasEjemplo = [
    ["Número de arete", "Sexo", "Arete del padre", "Arete de la madre"],
    ["C-001", "Macho", "", ""],
    ["C-002", "Hembra", "", ""],
    ["C-010", "Hembra", "C-001", "C-002"],
  ];
  filasEjemplo.forEach((f, i) =>
    f.forEach((valor, j) => {
      const c = ayuda.getCell(ejemplo + 1 + i, j + 1);
      c.value = valor;
      if (i === 0) c.font = { bold: true };
    }),
  );
  ayuda.getCell(ejemplo + 6, 1).value = "C-010 es hija de C-001 y C-002; el orden de las filas no importa. No copies estas filas a la hoja «Animales».";

  const datos = await libro.xlsx.writeBuffer();
  return Buffer.from(datos);
}
