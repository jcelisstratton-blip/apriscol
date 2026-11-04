// Cargue de animales desde el Excel de la persona: asistente de columnas, modos para los que ya existen, fechas y sexo flexibles, lectura de la hoja.
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { validarFilas, leerFecha, mapearEncabezados } from "../lib/importar-animales.ts";
import { proponerMapeo, faltantesDelMapeo, campoRepetido } from "../lib/importar-mapeo.ts";
import { analizarArchivo, leerArchivoAnimales } from "../lib/importar-animales-excel.ts";

const ctx = (extra = {}) => ({
  especies: ["caprino", "ovino"],
  razas: [{ id: 1, especie: "caprino", nombre: "Alpina" }],
  existentes: [
    { numero_arete: "A-1", sexo: "macho", especie: "caprino", fecha_nacimiento: "2022-01-01" },
    { numero_arete: "A-2", sexo: "hembra", especie: "caprino", fecha_nacimiento: "2022-02-01" },
  ],
  hoy: "2026-11-04",
  ...extra,
});
const fila = (n, valores) => ({ fila: n, valores });
const col = (encabezado, valores) => ({ indice: 0, encabezado, valores });

test("columnas: reconoce los títulos que usa la gente, sin importar tildes ni mayúsculas", () => {
  const m = proponerMapeo([
    col("CHAPETA", ["1", "2", "3"]),
    col("Género", ["H", "M", "H"]),
    col("F. Nac.", ["2022-01-02", "2021-05-06", "2023-03-03"]),
    col("Observaciones", ["x", "y", "z"]),
    col("Nombre del animal", ["Luna", "Rey", "Nube"]),
    col("Preñez", ["Sí", "No", "Sí"]),
  ]);
  assert.deepEqual(m, ["numero_arete", "sexo", "fecha_nacimiento", "notas", "nombre", "prenez_confirmada"]);
});

test("columnas: sin título útil, reconoce sexo y arete por su contenido", () => {
  const m = proponerMapeo([col("Col A", ["C-1", "C-2", "C-3", "C-4"]), col("Col B", ["Hembra", "Macho", "Hembra", "Hembra"]), col("Col C", ["x", "x", "y", "y"])]);
  assert.deepEqual(m, ["numero_arete", "sexo", null]);
});

test("columnas: «Padre» con aretes que ya existen se propone como arete; con nombres, como padre de fuera", () => {
  const conAretes = proponerMapeo([col("Arete", ["B-1", "B-2", "B-3"]), col("Padre", ["A-1", "A-1", ""])], ["A-1"]);
  assert.equal(conAretes[1], "padre_arete");
  const conNombres = proponerMapeo([col("Arete", ["B-1", "B-2", "B-3"]), col("Padre", ["Rey Mago", "Don Pepe", ""])], ["A-1"]);
  assert.equal(conNombres[1], "padre_externo");
});

test("columnas: un campo no se propone para dos columnas y «estado» solo por título exacto", () => {
  const m = proponerMapeo([col("Arete", ["1", "2"]), col("Número de arete", ["1", "2"]), col("Estado reproductivo", ["Preñada", "Vacía"])]);
  assert.equal(m.filter((x) => x === "numero_arete").length, 1);
  assert.notEqual(m[2], "estado", "«Estado reproductivo» no es el estado del animal");
  assert.equal(proponerMapeo([col("Estado", ["Activo", "Vendido"])])[0], "estado");
});

test("columnas: validación del mapeo", () => {
  assert.deepEqual(faltantesDelMapeo(["sexo", null]), ["Número de arete"]);
  assert.deepEqual(faltantesDelMapeo(["numero_arete"]), []);
  assert.equal(campoRepetido(["sexo", "nombre", "sexo"]), "Sexo");
  assert.equal(campoRepetido(["sexo", null, "nombre"]), null);
});

test("plantilla: los títulos de siempre se siguen reconociendo", () => {
  const { columnas, faltan } = mapearEncabezados(["Especie", "Número de arete *", "Sexo *", "Padre (si no está en tu hato)"]);
  assert.deepEqual(columnas, ["especie", "numero_arete", "sexo", "padre_externo"]);
  assert.deepEqual(faltan, []);
});

test("fechas: día/mes/año con año de dos cifras y con el mes en letras", () => {
  assert.equal(leerFecha("15/03/2023").valor, "2023-03-15");
  assert.equal(leerFecha("15/03/23").valor, "2023-03-15");
  assert.equal(leerFecha("15/03/99").valor, "1999-03-15");
  assert.equal(leerFecha("15 de marzo de 2023").valor, "2023-03-15");
  assert.equal(leerFecha("15-mar-2023").valor, "2023-03-15");
  assert.equal(leerFecha("3 sept 21").valor, "2021-09-03");
  assert.equal(leerFecha("2023-03-15").valor, "2023-03-15");
  assert.ok(leerFecha("31/02/2023").error);
  assert.ok(leerFecha("cualquier cosa").error);
});

test("sexo: acepta la inicial y el nombre del animal adulto", () => {
  const r = validarFilas([fila(2, { numero_arete: "N-1", sexo: "Cabra" }), fila(3, { numero_arete: "N-2", sexo: "m", especie: "caprino" }), fila(4, { numero_arete: "N-3", sexo: "carnero", especie: "ovino" })], ctx());
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => f.sexo), ["hembra", "macho", "macho"]);
});

test("especie: con las dos especies activas y sin columna, se deduce de «Cabra», «Carnero» o de la raza", () => {
  const r = validarFilas([fila(2, { numero_arete: "S-1", sexo: "H", raza: "Alpina" }), fila(3, { numero_arete: "S-2", sexo: "Oveja" })], ctx());
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => f.especie), ["caprino", "ovino"]);
  const sin = validarFilas([fila(2, { numero_arete: "S-3", sexo: "H" })], ctx());
  assert.match(sin.errores[0].mensajes.join(" "), /Falta la especie/);
});

test("estado: solo los estados de baja se omiten; «Preñada» o «Lactando» no", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "E-1", sexo: "Hembra", especie: "caprino", estado: "Vendido" }),
    fila(3, { numero_arete: "E-2", sexo: "Hembra", especie: "caprino", estado: "Preñada" }),
    fila(4, { numero_arete: "E-3", sexo: "Hembra", especie: "caprino", estado: "Lactando" }),
  ], ctx());
  assert.deepEqual(r.errores, []);
  assert.equal(r.filas.length, 2);
  assert.equal(r.resumen.omitidos, 1);
});

test("modo «solo nuevos»: el arete que ya existe se deja como está, aunque la fila traiga errores, y se ve en la revisión", () => {
  const r = validarFilas([fila(2, { numero_arete: "A-1", sexo: "Hembra", fecha_nacimiento: "basura" }), fila(3, { numero_arete: "N-1", sexo: "Hembra", especie: "caprino" })], ctx());
  assert.deepEqual(r.errores, []);
  assert.equal(r.resumen.nuevos, 1);
  assert.equal(r.resumen.ya_existen, 1);
  assert.equal(r.filas.length, 1, "solo lo nuevo se manda a guardar");
  assert.equal(r.vista.find((v) => v.numero_arete === "A-1").accion, "omitir");
});

test("modo «completar»: un animal que ya existe se actualiza sin pedir sexo ni especie, y sin una aptitud por defecto", () => {
  const r = validarFilas([fila(2, { numero_arete: "A-2", nombre: "Luna", chip: "123" })], ctx({ modo: "completar", aptitudDefecto: "leche" }));
  assert.deepEqual(r.errores, []);
  assert.equal(r.resumen.actualizar, 1);
  assert.equal(r.resumen.nuevos, 0);
  const f = r.filas[0];
  assert.equal(f.nombre, "Luna");
  assert.equal(f.sexo, "hembra", "el sexo sale del hato");
  assert.equal("vocacion" in f, false, "no se le cambia la aptitud si el archivo no la trae");
});

test("modo «corregir»: el sexo del archivo no puede contradecir al del hato", () => {
  const r = validarFilas([fila(2, { numero_arete: "A-1", sexo: "Hembra" })], ctx({ modo: "corregir" }));
  assert.match(r.errores[0].mensajes.join(" "), /ya existe en tu hato como macho/);
});

test("modo «completar»: avisa cuántos de los que ya existen traen servicio, parto o corral (no se registran)", () => {
  const r = validarFilas([fila(2, { numero_arete: "A-2", nombre: "Luna", fecha_ultimo_parto: "2025-01-01" })], ctx({ modo: "completar", reproduccion: true }));
  assert.deepEqual(r.errores, []);
  assert.equal(r.resumen.historia_ignorada, 1);
});

test("modo «completar»: una cría nueva puede tener como padre a un animal que ya existe, y los nuevos van antes que sus crías", () => {
  const r = validarFilas([
    fila(2, { numero_arete: "H-2", sexo: "Hembra", especie: "caprino", padre_arete: "A-1", madre_arete: "H-1" }),
    fila(3, { numero_arete: "H-1", sexo: "Hembra", especie: "caprino" }),
  ], ctx({ modo: "completar" }));
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => f.numero_arete), ["H-1", "H-2"]);
  assert.equal(r.resumen.con_padres_en_hato, 1);
});

async function libroDePrueba() {
  const libro = new ExcelJS.Workbook();
  const ayuda = libro.addWorksheet("Instrucciones");
  ayuda.getCell("A1").value = "ignorar";
  const h = libro.addWorksheet("Mi hato 2026");
  h.getCell("A1").value = "FINCA LA ESPERANZA — inventario";
  h.getCell("A2").value = null;
  ["Chapeta", "Genero", "Fecha nac", "Raza", "Madre", "Corral"].forEach((t, i) => (h.getCell(3, i + 1).value = t));
  [
    ["C-1", "H", new Date(Date.UTC(2020, 2, 15)), "Alpina", "", "Potrero 1"],
    ["C-2", "M", "15/03/2022", "Alpina", "C-1", ""],
    [null, null, null, null, null, null],
    ["C-3", "H", 44000, "", "C-1", ""],
  ].forEach((f, r) => f.forEach((v, c) => (h.getCell(4 + r, c + 1).value = v)));
  return libro.xlsx.writeBuffer();
}

test("archivo: encuentra la fila de títulos debajo de un encabezado, elige la hoja con datos y propone las columnas", async () => {
  const buffer = await libroDePrueba();
  const a = await analizarArchivo(buffer, { aretesDelHato: [] });
  assert.equal(a.ok, true);
  assert.equal(a.hoja, "Mi hato 2026");
  assert.deepEqual(a.hojas.map((x) => x.nombre), ["Mi hato 2026"], "las hojas de ayuda no cuentan");
  assert.equal(a.filaEncabezado, 3);
  assert.equal(a.totalFilas, 3);
  assert.deepEqual(a.propuesta, ["numero_arete", "sexo", "fecha_nacimiento", "raza", "madre_arete", "ubicacion"]);
});

test("archivo: lee las filas con las columnas confirmadas, salta las vacías y conserva el número de fila de Excel", async () => {
  const buffer = await libroDePrueba();
  const a = await analizarArchivo(buffer);
  const mapeo = a.columnas.map((c, i) => ({ indice: c.indice, campo: a.propuesta[i] })).filter((m) => m.campo);
  const l = await leerArchivoAnimales(buffer, { hoja: a.hoja, filaEncabezado: a.filaEncabezado, mapeo });
  assert.equal(l.ok, true);
  assert.deepEqual(l.filas.map((f) => f.fila), [4, 5, 7]);
  const r = validarFilas(l.filas, ctx({ especies: ["caprino"], razas: [{ id: 1, especie: "caprino", nombre: "Alpina" }], ubicaciones: [{ id: "u1", nombre: "Potrero 1", capacidad: null, ocupantes: 0 }] }));
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => f.numero_arete), ["C-1", "C-2", "C-3"]);
  assert.equal(r.filas.find((f) => f.numero_arete === "C-2").madre_arete, "C-1");
  assert.equal(r.filas.find((f) => f.numero_arete === "C-1").fecha_nacimiento, "2020-03-15");
});

test("archivo: sin la columna del arete no se puede leer", async () => {
  const buffer = await libroDePrueba();
  const l = await leerArchivoAnimales(buffer, { filaEncabezado: 3, mapeo: [{ indice: 1, campo: "sexo" }] });
  assert.equal(l.ok, false);
  assert.match(l.error, /Número de arete/);
});

test("archivo: un archivo que no es Excel da un mensaje claro", async () => {
  const a = await analizarArchivo(new TextEncoder().encode("no soy un excel").buffer);
  assert.equal(a.ok, false);
  assert.match(a.error, /No se pudo abrir/);
});
