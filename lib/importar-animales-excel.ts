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

/** Lee la hoja de animales del archivo subido. No valida las reglas del animal: eso lo hace `validarFilas`. */
export async function leerArchivoAnimales(buffer: ArrayBuffer): Promise<LecturaArchivo> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    return { ok: false, error: "No se pudo abrir el archivo. Usa la plantilla de Excel (.xlsx) que descargaste aquí." };
  }
  const hoja = libro.getWorksheet("Animales") ?? libro.worksheets[0];
  if (!hoja) return { ok: false, error: "El archivo no tiene hojas." };

  const encabezados: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => {
    encabezados[col - 1] = String(valorCelda(celda.value) ?? "");
  });
  const { columnas, faltan } = mapearEncabezados(encabezados);
  if (faltan.length > 0) {
    return { ok: false, error: `No encontré ${faltan.length === 1 ? "la columna" : "las columnas"} ${faltan.map((f) => `«${f}»`).join(" y ")} en la primera fila. Usa la plantilla sin cambiar los títulos de las columnas.` };
  }

  const filas: FilaCruda[] = [];
  for (let r = 2; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const valores: Partial<Record<ColumnaId, CeldaCruda>> = {};
    let tieneDatos = false;
    columnas.forEach((id, i) => {
      if (!id) return;
      const v = valorCelda(fila.getCell(i + 1).value);
      if (v === null || (typeof v === "string" && v.trim() === "")) return;
      valores[id] = v;
      tieneDatos = true;
    });
    if (!tieneDatos) continue;
    filas.push({ fila: r, valores });
    if (filas.length > MAX_FILAS_IMPORTAR) {
      return { ok: false, error: `El archivo tiene más de ${MAX_FILAS_IMPORTAR} animales. Divídelo en varios archivos de hasta ${MAX_FILAS_IMPORTAR}.` };
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
    `4. Hasta ${MAX_FILAS_IMPORTAR} animales por archivo. Solo se crean animales nuevos: uno con un arete que ya existe en tu finca se rechaza.`,
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
