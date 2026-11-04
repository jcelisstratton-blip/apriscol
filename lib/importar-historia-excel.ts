import ExcelJS from "exceljs";
import { COLOR, FMT, estiloEncabezado, relleno } from "@/lib/excel-estilo";
import { CAMPOS_HISTORIA, MAX_FILAS_HISTORIA, TITULO_HISTORIA, type TipoHistoria } from "@/lib/importar-historia";

/**
 * La plantilla de Excel de cada cargue de historia (pesos, ordeños, sanidad). Es opcional —el cargue acepta cualquier Excel y propone las columnas—, pero a quien
 * empieza de cero le dice exactamente qué poner y le da las listas desplegables. Los títulos son los de `CAMPOS_HISTORIA`, así que se reconocen solos.
 */

/** Hasta qué fila llegan los desplegables y los formatos (más filas harían pesado el archivo; el cargue acepta `MAX_FILAS_HISTORIA` aunque pasen de aquí). */
const FILAS_CON_LISTA = 3000;

const LISTAS: Record<string, string[]> = {
  tipo_pesaje: ["Control", "Destete", "Pre-beneficio"],
  tipo_sanidad: ["Vacunación", "Desparasitación", "Tratamiento", "Cirugía", "Podología", "Pediluvio", "Otro"],
  jornada: ["Mañana", "Tarde", "Noche", "Único"],
  si_no: ["No", "Sí"],
  via: ["Oral", "Subcutánea", "Intramuscular", "Intravenosa", "Tópica", "Intramamaria", "Otra"],
};

/** Qué lista lleva cada columna de cada cargue. */
const LISTA_DE: Record<TipoHistoria, Record<string, keyof typeof LISTAS>> = {
  pesajes: { tipo: "tipo_pesaje" },
  ordenos: { jornada: "jornada", descartada: "si_no" },
  sanidad: { tipo: "tipo_sanidad", via: "via" },
};

const AYUDA: Record<string, string> = {
  numero_arete: "El arete del animal. Ya debe estar en tu hato.",
  fecha: "Día/mes/año, por ejemplo 15/03/2025. No puede ser futura.",
  peso_kg: "En kilos, hasta 250. Puedes usar coma: 32,5.",
  tipo: "Elige de la lista.",
  condicion_corporal: "De 1 a 5, de medio en medio (3, 3,5, 4…).",
  observaciones: "Opcional.",
  litros: "Los litros de ese ordeño (hasta 15). Puedes usar coma: 1,2.",
  jornada: "Mañana, Tarde, Noche o Único. Si ordeñas una sola vez al día, déjala vacía.",
  descartada: "Sí si esa leche se botó. Vacío es No.",
  producto_nombre: "Nombre del producto. Va como texto: no mueve tu inventario.",
  dosis: "Un número mayor que cero.",
  unidad_dosis: "Por ejemplo ml, mg, cc, tableta.",
  via: "Elige de la lista.",
  lote_producto: "Opcional.",
  responsable: "Quién lo aplicó. Opcional.",
  diagnostico: "Opcional.",
  proxima_fecha: "Cuándo toca el refuerzo o la repetición. Debe ser posterior a la fecha del evento.",
  retiro_leche_dias: "Días sin vender la leche después del evento (0 a 365). Vacío es 0.",
  retiro_carne_dias: "Días sin vender la carne después del evento (0 a 365). Vacío es 0.",
};

const EXPLICACION: Record<TipoHistoria, string[]> = {
  pesajes: [
    "1. Una fila por pesaje: el arete del animal, la fecha y el peso en kilos. Un animal puede tener muchos pesajes, uno por día.",
    "2. «Tipo» es Control (por defecto), Destete o Pre-beneficio. La condición corporal es opcional.",
    "3. Si un animal ya tiene un peso registrado ese día, ese pesaje se deja como está.",
  ],
  ordenos: [
    "1. Una fila por ordeño: el arete de la hembra, la fecha y los litros. Son hembras: un macho se rechaza.",
    "2. Si ordeñas dos veces al día, pon la jornada (Mañana/Tarde); si es una sola vez, déjala vacía.",
    "3. Si ese animal ya tiene un ordeño ese día y jornada, ese ordeño se deja como está.",
  ],
  sanidad: [
    "1. Una fila por animal y evento: el arete, la fecha y el tipo (Vacunación, Desparasitación, Tratamiento, Cirugía, Podología, Pediluvio u Otro).",
    "2. Si das lo mismo a varios animales el mismo día (mismo tipo, producto, dosis…), quedan juntos en un solo evento, igual que al registrarlo a mano.",
    "3. El producto va solo como nombre: no mueve tu inventario. Los días de retiro (leche y carne) se cuentan desde la fecha del evento.",
    "4. Si un animal ya tiene ese mismo evento (fecha, tipo y producto), se deja como está.",
  ],
};

export async function construirPlantillaHistoria(tipo: TipoHistoria, finca: string): Promise<Buffer> {
  const campos = CAMPOS_HISTORIA[tipo];
  const libro = new ExcelJS.Workbook();
  libro.creator = "Apriscol";
  libro.created = new Date();
  const hoja = libro.addWorksheet("Registros", { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  const ayuda = libro.addWorksheet("Instrucciones");
  const listas = libro.addWorksheet("Listas");

  // Listas (de aquí salen los desplegables)
  const usadas = [...new Set(Object.values(LISTA_DE[tipo]))];
  const rangos = new Map<string, string>();
  usadas.forEach((clave, i) => {
    const valores = LISTAS[clave];
    listas.getColumn(i + 1).width = 20;
    listas.getCell(1, i + 1).value = clave.replace(/_/g, " ");
    listas.getCell(1, i + 1).font = { bold: true };
    valores.forEach((v, j) => (listas.getCell(j + 2, i + 1).value = v));
    const letra = String.fromCharCode(65 + i);
    rangos.set(clave, `Listas!$${letra}$2:$${letra}$${valores.length + 1}`);
  });

  campos.forEach((c, i) => {
    const celda = hoja.getCell(1, i + 1);
    celda.value = c.requerido ? `${c.titulo} *` : c.titulo;
    estiloEncabezado(celda, c.requerido ? COLOR.ocre : COLOR.musgo);
    celda.alignment = { vertical: "middle", wrapText: true };
    celda.note = AYUDA[c.id] ?? "";
    hoja.getColumn(i + 1).width = c.id === "numero_arete" ? 16 : c.id === "observaciones" || c.id === "producto_nombre" || c.id === "diagnostico" ? 26 : 16;
    const lista = LISTA_DE[tipo][c.id];
    for (let r = 2; r <= FILAS_CON_LISTA + 1; r++) {
      const cel = hoja.getCell(r, i + 1);
      if (c.id === "fecha" || c.id === "proxima_fecha") cel.numFmt = FMT.fecha;
      if (c.id === "numero_arete" || c.id === "lote_producto") cel.numFmt = "@";
      if (lista) {
        cel.dataValidation = { type: "list", allowBlank: true, formulae: [rangos.get(lista)!], showErrorMessage: true, errorStyle: "warning", errorTitle: "Valor de la lista", error: "Elige un valor de la lista." };
      }
    }
  });
  hoja.getRow(1).height = 34;

  ayuda.getColumn(1).width = 34;
  ayuda.getColumn(2).width = 92;
  const titulo = ayuda.getCell("A1");
  titulo.value = `Plantilla de ${TITULO_HISTORIA[tipo].corto} · ${finca}`;
  titulo.font = { bold: true, size: 15, color: { argb: COLOR.musgo } };
  const pasos = [
    ...EXPLICACION[tipo],
    `Hasta ${MAX_FILAS_HISTORIA.toLocaleString("es-CO")} registros por archivo. Las columnas con * son obligatorias. Guarda como .xlsx y súbelo en «Migrar mi finca»: la app revisa todo y te dice qué corregir antes de guardar.`,
    "Esta plantilla es opcional: también sirve tu propio Excel, con las columnas que tenga; la app te ayuda a emparejarlas.",
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
  estiloEncabezado(ayuda.getCell(desde, 1));
  estiloEncabezado(ayuda.getCell(desde, 2));
  campos.forEach((c, i) => {
    const a = ayuda.getCell(desde + 1 + i, 1);
    const b = ayuda.getCell(desde + 1 + i, 2);
    a.value = c.requerido ? `${c.titulo} *` : c.titulo;
    a.font = { bold: c.requerido };
    b.value = AYUDA[c.id] ?? "";
    b.alignment = { wrapText: true, vertical: "top" };
    if (i % 2 === 0) for (const x of [a, b]) x.fill = relleno(COLOR.lana);
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}
