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

// ───────────────────────── Historia (pesajes y ordeños) y «Migrar mi finca» ─────────────────────────
import { validarHistoria, proponerMapeoHistoria, faltantesHistoria, puntajeTituloHistoria } from "../lib/importar-historia.ts";
import { pasosMigracion, avanceMigracion, etapasMigracion, siguientePaso } from "../lib/migracion.ts";

const hato = [
  { numero_arete: "H-1", sexo: "hembra" },
  { numero_arete: "H-2", sexo: "hembra" },
  { numero_arete: "M-1", sexo: "macho" },
];
const hoyH = "2026-11-04";
const fh = (n, valores) => ({ fila: n, valores });

test("historia: reconoce los títulos de un cuaderno de pesos y de leche", () => {
  const p = proponerMapeoHistoria("pesajes", [col("Chapeta", ["H-1"]), col("Fecha de pesaje", ["2026-01-01"]), col("Peso kg", ["30"]), col("Observaciones", ["bien"])]);
  assert.deepEqual(p, ["numero_arete", "fecha", "peso_kg", "observaciones"]);
  const o = proponerMapeoHistoria("ordenos", [col("Animal", ["H-1"]), col("Día", ["01/09/2026", "02/09/2026"]), col("Turno", ["AM", "PM"]), col("Leche", ["1,2", "0,9"])]);
  assert.deepEqual(o, ["numero_arete", "fecha", "jornada", "litros"]);
  assert.deepEqual(faltantesHistoria("ordenos", ["numero_arete", "fecha"]), ["Litros"]);
  assert.ok(puntajeTituloHistoria("pesajes", "Peso kg") > 0);
  assert.equal(puntajeTituloHistoria("pesajes", "FINCA LA ESPERANZA"), 0);
});

test("historia: sin título de fecha, la columna de fechas se reconoce por su contenido", () => {
  const p = proponerMapeoHistoria("pesajes", [col("Arete", ["H-1", "H-2"]), col("Col B", ["15/03/2026", "16/03/2026"]), col("Peso", ["30", "31"])]);
  assert.deepEqual(p, ["numero_arete", "fecha", "peso_kg"]);
});

test("historia: pesajes correctos se redondean, entienden coma decimal y tipos escritos a mano", () => {
  const r = validarHistoria("pesajes", [
    fh(2, { numero_arete: "h-1", fecha: "15/03/2026", peso_kg: "32,46", tipo: "Destete" }),
    fh(3, { numero_arete: "H-2", fecha: "2026-03-16", peso_kg: 40, tipo: "pre-beneficio", condicion_corporal: "3,5" }),
  ], { animales: hato, hoy: hoyH });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => [f.peso_kg, f.tipo, f.condicion_corporal ?? null]), [[32.5, "destete", null], [40, "pre_beneficio", 3.5]]);
  assert.equal(r.resumen.animales, 2);
  assert.equal(r.resumen.desde, "2026-03-15");
  assert.equal(r.muestra.length, 2);
});

test("historia: rechaza peso imposible, fecha futura, repetidos y animales que no son del hato (una sola vez por arete)", () => {
  const r = validarHistoria("pesajes", [
    fh(2, { numero_arete: "H-1", fecha: "2026-03-15", peso_kg: 300 }),
    fh(3, { numero_arete: "H-1", fecha: "2027-01-01", peso_kg: 30 }),
    fh(4, { numero_arete: "H-2", fecha: "2026-03-15", peso_kg: 30 }),
    fh(5, { numero_arete: "H-2", fecha: "2026-03-15", peso_kg: 31 }),
    fh(6, { numero_arete: "X-9", fecha: "2026-03-15", peso_kg: 30 }),
    fh(7, { numero_arete: "X-9", fecha: "2026-03-16", peso_kg: 30 }),
  ], { animales: hato, hoy: hoyH });
  const msgs = r.errores.map((e) => `${e.fila}: ${e.mensajes.join(" ")}`).join("\n");
  assert.match(msgs, /250 kg/);
  assert.match(msgs, /futura/);
  assert.match(msgs, /se repite/);
  assert.equal(r.errores.filter((e) => /X-9/.test(e.mensajes.join(" "))).length, 1, "un arete desconocido se reporta una vez");
  assert.match(msgs, /Aparece en 2 filas/);
  assert.equal(r.filas.length, 0, "con errores no se manda nada");
  assert.equal(r.resumen.total_errores, 4);
});

test("historia: los ordeños son de hembras, aceptan jornada escrita de varias formas y suman litros", () => {
  const r = validarHistoria("ordenos", [
    fh(2, { numero_arete: "H-1", fecha: "2026-09-01", jornada: "AM", litros: "1,2" }),
    fh(3, { numero_arete: "H-1", fecha: "2026-09-01", jornada: "Tarde", litros: 0.9 }),
    fh(4, { numero_arete: "H-2", fecha: "2026-09-01", litros: 2, descartada: "Sí" }),
  ], { animales: hato, hoy: hoyH });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => f.jornada ?? "unico"), ["manana", "tarde", "unico"]);
  assert.equal(r.filas[2].descartada, true);
  assert.equal(r.resumen.suma, 4.1);
  const macho = validarHistoria("ordenos", [fh(2, { numero_arete: "M-1", fecha: "2026-09-01", litros: 1 })], { animales: hato, hoy: hoyH });
  assert.match(macho.errores[0].mensajes[0], /macho/);
  const mucho = validarHistoria("ordenos", [fh(2, { numero_arete: "H-1", fecha: "2026-09-01", litros: 40 })], { animales: hato, hoy: hoyH });
  assert.match(mucho.errores[0].mensajes[0], /15 litros/);
});

test("historia: dos ordeños del mismo día solo chocan si son de la misma jornada", () => {
  const dos = validarHistoria("ordenos", [fh(2, { numero_arete: "H-1", fecha: "2026-09-01", litros: 1 }), fh(3, { numero_arete: "H-1", fecha: "2026-09-01", litros: 2 })], { animales: hato, hoy: hoyH });
  assert.match(dos.errores[0].mensajes[0], /se repite/);
});

const permisosTodos = { hato: true, corrales: true, reproduccion: true, carne: true, leche: true, sanidad: true, medicamentos: true, alimento: true };
const vacio = { ubicaciones: 0, animales: 0, desdeExcel: 0, conPadres: 0, servicios: 0, lactancias: 0, pesajes: 0, ordenos: 0, eventosSanitarios: 0, productosVet: 0, aperturasVet: 0, alimentos: 0, aperturasAlimento: 0 };

test("migrar: sin animales, la historia y la revisión están bloqueadas y dicen por qué; la bodega y los corrales no dependen de ellos", () => {
  const pasos = pasosMigracion(vacio, permisosTodos);
  const por = Object.fromEntries(pasos.map((p) => [p.id, p]));
  assert.deepEqual(pasos.map((p) => p.id), ["corrales", "animales", "pesajes", "ordenos", "sanidad", "medicamentos", "alimento", "revision"]);
  for (const id of ["pesajes", "ordenos", "sanidad", "revision"]) {
    assert.equal(por[id].estado, "bloqueado", id);
    assert.match(por[id].motivo, /Primero carga tus animales/);
  }
  for (const id of ["corrales", "animales", "medicamentos", "alimento"]) assert.equal(por[id].estado, "pendiente", id);
  assert.equal(por.corrales.href, "/hato/importar/historia/corrales");
  assert.equal(por.corrales.alternativa.href, "/hato?vista=corrales");
  assert.deepEqual(avanceMigracion(pasos), { hechos: 0, total: 7 });
});

test("migrar: el orden es por etapas y cada paso de cada cargue lleva a su pantalla", () => {
  const etapas = etapasMigracion(pasosMigracion(vacio, permisosTodos));
  assert.deepEqual(etapas.map((e) => [e.id, e.pasos.map((p) => p.id)]), [
    ["preparar", ["corrales"]],
    ["hato", ["animales"]],
    ["historia", ["pesajes", "ordenos", "sanidad"]],
    ["bodega", ["medicamentos", "alimento"]],
    ["cierre", ["revision"]],
  ]);
  const por = Object.fromEntries(pasosMigracion(vacio, permisosTodos).map((p) => [p.id, p]));
  assert.equal(por.medicamentos.href, "/hato/importar/historia/medicamentos");
  assert.equal(por.alimento.href, "/hato/importar/historia/alimento");
  for (const id of ["corrales", "animales", "pesajes", "ordenos", "sanidad", "medicamentos", "alimento"]) assert.equal(por[id].porExcel, true, id);
});

test("migrar: los animales llevan su genealogía y sus partos como partes del mismo paso", () => {
  const pasos = pasosMigracion({ ...vacio, animales: 120, desdeExcel: 120, conPadres: 80, servicios: 10, lactancias: 20 }, permisosTodos);
  const a = pasos.find((p) => p.id === "animales");
  assert.equal(a.estado, "hecho");
  assert.deepEqual(a.subpasos.map((s) => [s.titulo, s.hecho]), [["Animales", true], ["Genealogía (padre y madre)", true], ["Partos y servicios", true]]);
  assert.match(a.subpasos[0].dato, /120 animales · 120 desde Excel/);
  assert.equal(a.subpasos[1].dato, "80 de 120 con padre o madre");
  const sinGenealogia = pasosMigracion({ ...vacio, animales: 5 }, permisosTodos).find((p) => p.id === "animales");
  assert.deepEqual(sinGenealogia.subpasos.map((s) => s.hecho), [true, false, false]);
  const sinRepro = pasosMigracion({ ...vacio, animales: 5 }, { ...permisosTodos, reproduccion: false }).find((p) => p.id === "animales");
  assert.equal(sinRepro.subpasos.length, 2, "sin permiso de reproducción no se ofrece lo de partos");
});

test("migrar: con datos cargados cada paso refleja lo que hay, y el siguiente es el primero que falta", () => {
  const c = { ...vacio, ubicaciones: 3, animales: 120, conPadres: 80, pesajes: 300, productosVet: 12, aperturasVet: 20, alimentos: 4, aperturasAlimento: 4 };
  const pasos = pasosMigracion(c, permisosTodos);
  const por = Object.fromEntries(pasos.map((p) => [p.id, p]));
  assert.equal(por.corrales.accion, "Cargar más corrales");
  assert.equal(por.pesajes.estado, "hecho");
  assert.equal(por.ordenos.estado, "pendiente");
  assert.equal(por.medicamentos.dato, "12 productos · 20 lotes contados");
  assert.equal(por.alimento.dato, "4 alimentos · 4 contados");
  assert.deepEqual(avanceMigracion(pasos), { hechos: 5, total: 7 });
  assert.equal(siguientePaso(pasos).id, "ordenos");
  const todos = pasosMigracion({ ...c, ordenos: 10, eventosSanitarios: 5 }, permisosTodos);
  assert.equal(siguientePaso(todos), null, "solo queda la revisión, que no cuenta como trabajo");
  assert.deepEqual(avanceMigracion(todos), { hechos: 7, total: 7 });
});

test("migrar: productos cargados sin contar se avisan, y el siguiente paso con animales vacíos es el de los animales", () => {
  const p = pasosMigracion({ ...vacio, productosVet: 6, alimentos: 2 }, permisosTodos);
  assert.equal(p.find((x) => x.id === "medicamentos").dato, "6 productos sin contar");
  assert.equal(p.find((x) => x.id === "alimento").dato, "2 alimentos sin contar");
  assert.equal(siguientePaso(p).id, "corrales");
});

test("migrar: los pasos de un módulo que el rol o el plan no permite no aparecen, ni la etapa que se queda sin pasos", () => {
  const pasos = pasosMigracion({ ...vacio, animales: 5 }, { ...permisosTodos, leche: false, carne: false, medicamentos: false, alimento: false, corrales: false });
  assert.deepEqual(pasos.map((p) => p.id), ["animales", "sanidad", "revision"]);
  assert.deepEqual(etapasMigracion(pasos).map((e) => e.id), ["hato", "historia", "cierre"]);
});

test("sanidad: reconoce los títulos, entiende los tipos y vías escritos a mano y arma el resumen por eventos", () => {
  const p = proponerMapeoHistoria("sanidad", [col("Chapeta", ["H-1"]), col("Fecha", ["2026-06-01"]), col("Actividad", ["Vacuna"]), col("Vacuna", ["Clostridial"]), col("Dosis", ["2"]), col("Vía", ["SC"]), col("Refuerzo", ["01/12/2026"])]);
  assert.deepEqual(p, ["numero_arete", "fecha", "tipo", "producto_nombre", "dosis", "via", "proxima_fecha"]);
  const r = validarHistoria("sanidad", [
    fh(2, { numero_arete: "H-1", fecha: "2026-06-01", tipo: "Vacuna", producto_nombre: "Clostridial", dosis: "2", unidad_dosis: "ml", via: "SC", proxima_fecha: "01/12/2026" }),
    fh(3, { numero_arete: "H-2", fecha: "2026-06-01", tipo: "Vacunación", producto_nombre: "Clostridial", dosis: 2, unidad_dosis: "ml", via: "subcutánea", proxima_fecha: "2026-12-01" }),
    fh(4, { numero_arete: "M-1", fecha: "2026-06-01", tipo: "Desparasitación", producto_nombre: "Ivermectina", retiro_leche_dias: "4", retiro_carne_dias: 28 }),
  ], { animales: hato, hoy: hoyH });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map((f) => [f.tipo, f.via ?? null]), [["vacunacion", "subcutanea"], ["vacunacion", "subcutanea"], ["desparasitacion", null]]);
  assert.equal(r.resumen.animales, 3);
  assert.equal(r.resumen.suma, 2, "las dos vacunas iguales son un solo evento");
  assert.match(r.muestra[0].detalle, /Vacunación · Clostridial · 2 ml · Próxima 01\/12\/2026/);
  assert.equal(r.filas[2].retiro_leche_dias, 4);
});

test("sanidad: el tipo es obligatorio y se rechazan vías, dosis, próxima fecha y retiros imposibles", () => {
  const r = validarHistoria("sanidad", [
    fh(2, { numero_arete: "H-1", fecha: "2026-06-01" }),
    fh(3, { numero_arete: "H-1", fecha: "2026-06-02", tipo: "baile" }),
    fh(4, { numero_arete: "H-1", fecha: "2026-06-03", tipo: "vacuna", via: "por la nariz" }),
    fh(5, { numero_arete: "H-1", fecha: "2026-06-04", tipo: "vacuna", dosis: "0" }),
    fh(6, { numero_arete: "H-1", fecha: "2026-06-05", tipo: "vacuna", proxima_fecha: "2026-06-01" }),
    fh(7, { numero_arete: "H-1", fecha: "2026-06-06", tipo: "tratamiento", retiro_leche_dias: "400" }),
  ], { animales: hato, hoy: hoyH });
  const msgs = r.errores.map((e) => e.mensajes.join(" ")).join("\n");
  assert.match(msgs, /Falta el tipo de evento/);
  assert.match(msgs, /«baile» no es válido/);
  assert.match(msgs, /vía «por la nariz»/);
  assert.match(msgs, /dosis debe ser un número mayor que cero/);
  assert.match(msgs, /próxima fecha debe ser posterior/);
  assert.match(msgs, /retiro de leche deben ser/);
  assert.equal(r.resumen.total_errores, 6);
});

test("sanidad: dos veces lo mismo al mismo animal el mismo día es un repetido", () => {
  const r = validarHistoria("sanidad", [fh(2, { numero_arete: "H-1", fecha: "2026-06-01", tipo: "vacuna", producto_nombre: "A" }), fh(3, { numero_arete: "H-1", fecha: "2026-06-01", tipo: "vacuna", producto_nombre: "a" })], { animales: hato, hoy: hoyH });
  assert.match(r.errores[0].mensajes[0], /se repite/);
  const distinto = validarHistoria("sanidad", [fh(2, { numero_arete: "H-1", fecha: "2026-06-01", tipo: "vacuna", producto_nombre: "A" }), fh(3, { numero_arete: "H-1", fecha: "2026-06-01", tipo: "vacuna", producto_nombre: "B" })], { animales: hato, hoy: hoyH });
  assert.deepEqual(distinto.errores, []);
});

test("migrar: sanidad ahora se carga por Excel", () => {
  const pasos = pasosMigracion({ ...vacio, animales: 10, eventosSanitarios: 3 }, permisosTodos);
  const s = pasos.find((p) => p.id === "sanidad");
  assert.equal(s.href, "/hato/importar/historia/sanidad");
  assert.equal(s.porExcel, true);
  assert.equal(s.estado, "hecho");
});

// ───────────────────────── Qué cambia, tramos y grupos ─────────────────────────
import { FILAS_POR_TRAMO, MAX_FILAS_IMPORTAR } from "../lib/importar-animales.ts";
import { agruparTramos } from "../lib/cargues.ts";

const existenteCompleto = (extra = {}) => ({ numero_arete: "A-3", sexo: "hembra", especie: "caprino", fecha_nacimiento: "2022-03-01", nombre: "Nube", raza_id: 1, chip: null, tiene_padre: false, tiene_madre: true, ...extra });

test("qué cambia: al completar solo entra lo que el animal tiene vacío; al corregir, lo que el archivo trae distinto", () => {
  const filas = [fila(2, { numero_arete: "A-3", nombre: "Otra", chip: "999", color: "Blanca", fecha_nacimiento: "2022-03-01" })];
  const completar = validarFilas(filas, ctx({ modo: "completar", existentes: [existenteCompleto()] }));
  assert.deepEqual(completar.vista[0].cambios.sort(), ["Color: — → Blanca", "Microchip: — → 999"]);
  const corregir = validarFilas(filas, ctx({ modo: "corregir", existentes: [existenteCompleto()] }));
  assert.deepEqual(corregir.vista[0].cambios.sort(), ["Color: — → Blanca", "Microchip: — → 999", "Nombre: Nube → Otra"]);
});

test("qué cambia: la genealogía solo se completa; sin nada que cambiar no se manda a guardar", () => {
  const ya = validarFilas([fila(2, { numero_arete: "A-3", nombre: "Nube", madre_arete: "A-2" })], ctx({ modo: "corregir", existentes: [existenteCompleto(), { numero_arete: "A-2", sexo: "hembra", especie: "caprino", fecha_nacimiento: "2020-01-01" }] }));
  assert.deepEqual(ya.errores, []);
  assert.equal(ya.resumen.sin_cambios, 1);
  assert.equal(ya.filas.length, 0, "el animal ya tiene madre y nombre: no hay nada que hacer");
  assert.deepEqual(ya.vista[0].cambios, []);
  const padre = validarFilas([fila(2, { numero_arete: "A-3", padre_arete: "A-1" })], ctx({ modo: "completar", existentes: [existenteCompleto(), { numero_arete: "A-1", sexo: "macho", especie: "caprino", fecha_nacimiento: "2020-01-01" }] }));
  assert.deepEqual(padre.vista.find((v) => v.numero_arete === "A-3").cambios, ["Padre: — → A-1"]);
  assert.equal(padre.resumen.actualizar, 1);
});

test("tramos: el tope por archivo es de 2.000 y cada tramo guarda 500", () => {
  assert.equal(MAX_FILAS_IMPORTAR, 2000);
  assert.equal(FILAS_POR_TRAMO, 500);
});

test("historial: los tramos de un mismo archivo se ven como uno solo y se deshacen juntos", () => {
  const c = (id, grupo, creados, estado = "aplicada") => ({ id, tipo: "animales", archivo: "hato.xlsx", modo: "nuevos", creados, actualizados: 0, estado, created_at: "2026-11-04T16:00:00Z", grupo });
  const lista = agruparTramos([c("4", "g1", 100), c("3", "g1", 500), c("2", "g1", 500), c("1", null, 7)]);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].creados, 1100);
  assert.equal(lista[0].grupo, "g1");
  assert.equal(lista[1].creados, 7);
  const deshechos = agruparTramos([c("2", "g2", 5, "deshecha"), c("1", "g2", 5, "deshecha")]);
  assert.equal(deshechos[0].estado, "deshecha");
  const mixto = agruparTramos([c("2", "g3", 5, "deshecha"), c("1", "g3", 5, "aplicada")]);
  assert.equal(mixto[0].estado, "aplicada");
});

// ───────────────────────── Plantillas de historia ─────────────────────────
import { construirPlantillaHistoria } from "../lib/importar-historia-excel.ts";
import { CAMPOS_HISTORIA } from "../lib/importar-historia.ts";

for (const tipo of ["pesajes", "ordenos", "sanidad"]) {
  test(`plantilla de ${tipo}: sus títulos se reconocen solos y cada valor de sus listas lo acepta la validación`, async () => {
    const buffer = await construirPlantillaHistoria(tipo, "Finca de prueba");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    assert.deepEqual(libro.worksheets.map((h) => h.name), ["Registros", "Instrucciones", "Listas"]);
    const a = await analizarArchivo(buffer, { reconocer: (t) => puntajeTituloHistoria(tipo, t), proponer: (c) => proponerMapeoHistoria(tipo, c) });
    assert.equal(a.ok, false, "la plantilla está vacía: no hay registros todavía");
    // Con una fila de ejemplo sí se reconoce cada columna
    const hoja = libro.getWorksheet("Registros");
    const campos = CAMPOS_HISTORIA[tipo];
    campos.forEach((c, i) => (hoja.getCell(2, i + 1).value = c.id === "fecha" || c.id === "proxima_fecha" ? "01/06/2026" : "x"));
    const lleno = await libro.xlsx.writeBuffer();
    const b = await analizarArchivo(lleno, { reconocer: (t) => puntajeTituloHistoria(tipo, t), proponer: (c) => proponerMapeoHistoria(tipo, c) });
    assert.equal(b.ok, true);
    assert.deepEqual(b.propuesta, campos.map((c) => c.id));
    assert.equal(b.filaEncabezado, 1);

    // Las listas desplegables: lo que ofrecen es lo que la validación entiende.
    const listas = libro.getWorksheet("Listas");
    const valoresDe = (campo) => {
      const col = campos.findIndex((c) => c.id === campo) + 1;
      if (col === 0) return [];
      const f = hoja.getCell(2, col).dataValidation?.formulae?.[0];
      if (!f) return [];
      const [, rango] = f.split("!");
      const [, letra, desde, hasta] = /\$([A-Z])\$(\d+):\$[A-Z]\$(\d+)/.exec(rango);
      const out = [];
      for (let r = +desde; r <= +hasta; r++) out.push(String(listas.getCell(`${letra}${r}`).value));
      return out;
    };
    const base = { numero_arete: "H-1", fecha: "2026-06-01", peso_kg: 30, litros: 1, tipo: "vacuna" };
    for (const campo of ["tipo", "jornada", "descartada", "via"]) {
      for (const v of valoresDe(campo)) {
        const r = validarHistoria(tipo, [fh(2, { ...base, ...(tipo === "sanidad" && campo !== "tipo" ? {} : {}), [campo]: v })], { animales: hato, hoy: hoyH });
        assert.deepEqual(r.errores, [], `${tipo}: «${v}» en ${campo}`);
      }
    }
  });
}

// ───────────────────────── Corrales, medicamentos y alimento ─────────────────────────
import { validarCatalogo, paraGuardarCatalogo } from "../lib/importar-catalogo.ts";
import { esCatalogo, puedeCargar, CLAVE_HISTORIA, TIPOS_HISTORIA } from "../lib/importar-historia.ts";

const cat = (extra = {}) => ({ hoy: "2026-11-04", corrales: [], productosVet: [], alimentos: [], ...extra });

test("corrales: reconoce los títulos, deduce corral o potrero y exige la capacidad de un corral", () => {
  const p = proponerMapeoHistoria("corrales", [col("Corral", ["A", "B"]), col("Cupo", ["20", "30"]), col("Metros", ["50", "60"]), col("Observaciones", ["x", "y"])]);
  assert.deepEqual(p, ["nombre", "capacidad", "area_m2", "observaciones"]);
  const r = validarCatalogo("corrales", [
    fh(2, { nombre: "Corral 1", capacidad: "25", uso: "Ordeño", piso: "Cemento", agua: "Sí" }),
    fh(3, { nombre: "Potrero Norte", area_m2: "5.000", dias_ocupacion_max: "4", dias_descanso_min: 40 }),
    fh(4, { nombre: "Corral sin cupo", tipo: "Corral" }),
  ], cat());
  assert.match(r.errores[0].mensajes[0], /necesita su capacidad/);
  assert.equal(r.resumen.total_errores, 1);
  const bien = validarCatalogo("corrales", [fh(2, { nombre: "Corral 1", capacidad: "25", uso: "Ordeño", piso: "Cemento", agua: "Sí" }), fh(3, { nombre: "Potrero Norte", area_m2: "5.000" })], cat());
  assert.deepEqual(bien.errores, []);
  assert.deepEqual(bien.filas.map((f) => [f.tipo, f.capacidad ?? null, f.uso ?? null]), [["corral", 25, "ordeno"], ["potrero", null, null]]);
  assert.equal(bien.filas[1].area_m2, 5000, "5.000 son cinco mil metros");
  assert.equal(bien.resumen.suma, 25);
});

test("corrales: uno que ya existe se deja como está y uno repetido en el archivo es un error", () => {
  const r = validarCatalogo("corrales", [fh(2, { nombre: "corral 1", capacidad: 10 }), fh(3, { nombre: "Corral 2", capacidad: 10 })], cat({ corrales: ["Corral 1"] }));
  assert.deepEqual(r.errores, []);
  assert.equal(r.filas.length, 1);
  assert.equal(r.resumen.ya_existen, 1);
  const dup = validarCatalogo("corrales", [fh(2, { nombre: "A", capacidad: 10 }), fh(3, { nombre: "a", capacidad: 10 })], cat());
  assert.match(dup.errores[0].mensajes[0], /se repite/);
});

test("medicamentos: un producto con presentación se cuenta en frascos y la base recibe la unidad de la dosis", () => {
  const r = validarCatalogo("medicamentos", [
    fh(2, { nombre: "Ivermectina", tipo: "Desparasitante", unidad_dosis: "ml", presentacion: "frasco", contenido_presentacion: "100", stock_minimo: 2, retiro_leche_dias: 28, lote: "L1", vencimiento: "01/05/2027", cantidad: "3" }),
    fh(3, { nombre: "ivermectina", lote: "L2", vencimiento: "2027-08-01", cantidad: "1,5" }),
    fh(4, { nombre: "Vacuna Clostridial", tipo: "Vacuna", unidad_dosis: "dosis", cantidad: 40 }),
  ], cat());
  assert.deepEqual(r.errores, []);
  const [a, b, c] = r.filas;
  assert.equal(a.cantidad, 300);
  assert.equal(a.stock_minimo, 200);
  assert.equal(a.contenido_presentacion, 100);
  assert.equal(b.cantidad, 150, "las otras filas del producto se cuentan igual (en frascos)");
  assert.equal(c.cantidad, 40);
  assert.equal(c.tipo, "vacuna");
  assert.equal(r.resumen.animales, 2, "dos productos");
  assert.match(r.muestra[0].detalle, /3 frasco = 300/);
  const base = paraGuardarCatalogo(r.filas)[0];
  assert.equal("factor" in base, false, "los datos de apoyo no van a la base");
});

test("medicamentos: un producto que ya existe usa su presentación; el archivo no la cambia", () => {
  const r = validarCatalogo("medicamentos", [fh(2, { nombre: "Ivermectina", lote: "L9", cantidad: 2 })], cat({ productosVet: [{ nombre: "ivermectina", presentacion: "frasco", contenido_presentacion: 50 }] }));
  assert.deepEqual(r.errores, []);
  assert.equal(r.filas[0].cantidad, 100);
  assert.equal(r.filas[0].tipo, undefined, "no se vuelve a mandar el catálogo de un producto que ya existe");
  assert.equal(r.resumen.ya_existen, 1);
});

test("medicamentos: rechaza lotes repetidos, presentación sin contenido, vencimientos y cantidades imposibles; cuenta los vencidos", () => {
  const r = validarCatalogo("medicamentos", [
    fh(2, { nombre: "A", lote: "L1", cantidad: 1 }),
    fh(3, { nombre: "a", lote: "l1", cantidad: 2 }),
    fh(4, { nombre: "B", presentacion: "frasco", cantidad: 1 }),
    fh(5, { nombre: "C", cantidad: -3 }),
    fh(6, { nombre: "D", vencimiento: "31/02/2027", cantidad: 1 }),
    fh(7, { nombre: "E" }),
  ], cat());
  const msgs = r.errores.map((e) => e.mensajes.join(" ")).join("\n");
  assert.match(msgs, /Este lote ya está en la fila 2/);
  assert.match(msgs, /van juntos/);
  assert.match(msgs, /cantidad debe ser/);
  assert.match(msgs, /vencimiento no es válido/);
  assert.match(msgs, /Falta la cantidad/);
  assert.equal(r.resumen.total_errores, 5);
  const venc = validarCatalogo("medicamentos", [fh(2, { nombre: "F", lote: "L", vencimiento: "2025-01-01", cantidad: 5 }), fh(3, { nombre: "G", lote: "M", vencimiento: "2025-01-01", cantidad: 0 })], cat());
  assert.equal(venc.resumen.suma, 1, "solo cuenta el vencido con existencias");
});

test("alimento: un alimento nuevo pide su rubro; uno que ya existe no; y todo se cuenta en kg", () => {
  const r = validarCatalogo("alimento", [
    fh(2, { nombre: "Concentrado lecheras", rubro: "Concentrado", unidad: "bulto", kg_por_unidad: 40, cantidad: "800" }),
    fh(3, { nombre: "Heno", rubro: "forraje", cantidad: "1.200" }),
    fh(4, { nombre: "Sal mineralizada", rubro: "Sales", cantidad: 50 }),
    fh(5, { nombre: "Maíz", cantidad: 10 }),
    fh(6, { nombre: "Sustituto", rubro: "Leche maternizada", cantidad: 25 }),
  ], cat());
  assert.match(r.errores[0].mensajes[0], /Falta el rubro/);
  assert.equal(r.resumen.total_errores, 1);
  const bien = validarCatalogo("alimento", [fh(2, { nombre: "Concentrado lecheras", rubro: "Concentrado", unidad: "bulto", kg_por_unidad: 40, cantidad: "800" }), fh(3, { nombre: "Heno", rubro: "forraje", cantidad: "1.200" }), fh(4, { nombre: "Sal", cantidad: 50 })], cat({ alimentos: [{ nombre: "sal", rubro: "sales_suplementos" }] }));
  assert.deepEqual(bien.errores, []);
  assert.deepEqual(bien.filas.map((f) => [f.nombre, f.rubro ?? null, f.cantidad]), [["Concentrado lecheras", "concentrado", 800], ["Heno", "forraje", 1200], ["Sal", null, 50]]);
  assert.equal(bien.resumen.suma, 2050);
  assert.equal(bien.resumen.nuevos, 2);
  assert.equal(bien.resumen.ya_existen, 1);
});

test("alimento: un nombre que ya es otro producto no se pisa y un alimento repetido es un error", () => {
  const r = validarCatalogo("alimento", [fh(2, { nombre: "Fletes", cantidad: 5 }), fh(3, { nombre: "Heno", rubro: "forraje", cantidad: 5 }), fh(4, { nombre: "HENO", rubro: "forraje", cantidad: 5 })], cat({ alimentos: [{ nombre: "Fletes", rubro: "fletes" }] }));
  const msgs = r.errores.map((e) => e.mensajes.join(" ")).join("\n");
  assert.match(msgs, /que no es un alimento/);
  assert.match(msgs, /se repite/);
});

test("catálogos: quién puede cargar cada uno y cuál es su columna clave", () => {
  assert.equal(esCatalogo("corrales") && esCatalogo("medicamentos") && esCatalogo("alimento"), true);
  assert.equal(esCatalogo("pesajes"), false);
  assert.equal(puedeCargar("alimento", "propietario", "hacienda"), true);
  assert.equal(puedeCargar("alimento", "ordenador", "hacienda"), false, "el ordeñador anota salidas, no cuenta el inventario");
  assert.equal(puedeCargar("medicamentos", "veterinario", "hacienda"), false, "el veterinario ve el inventario, no lo mueve");
  assert.equal(puedeCargar("sanidad", "veterinario", "hacienda"), true);
  assert.equal(CLAVE_HISTORIA.corrales.id, "nombre");
  assert.equal(CLAVE_HISTORIA.pesajes.id, "numero_arete");
});

for (const tipo of ["corrales", "medicamentos", "alimento"]) {
  test(`plantilla de ${tipo}: sus títulos se reconocen solos y cada valor de sus listas lo acepta la validación`, async () => {
    const buffer = await construirPlantillaHistoria(tipo, "Finca de prueba");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    assert.deepEqual(libro.worksheets.map((h) => h.name), ["Registros", "Instrucciones", "Listas"]);
    const hoja = libro.getWorksheet("Registros");
    const campos = CAMPOS_HISTORIA[tipo];
    campos.forEach((c, i) => (hoja.getCell(2, i + 1).value = c.id === "fecha" || c.id === "vencimiento" ? "01/06/2026" : "x"));
    const lleno = await libro.xlsx.writeBuffer();
    const b = await analizarArchivo(lleno, { reconocer: (t) => puntajeTituloHistoria(tipo, t), proponer: (c) => proponerMapeoHistoria(tipo, c) });
    assert.equal(b.ok, true);
    assert.deepEqual(b.propuesta, campos.map((c) => c.id));
    assert.equal(b.filaEncabezado, 1);

    // Cada valor que ofrece una lista desplegable lo entiende la validación del cargue.
    const listas = libro.getWorksheet("Listas");
    const valoresDe = (campo) => {
      const col = campos.findIndex((c) => c.id === campo) + 1;
      if (col === 0) return [];
      const f = hoja.getCell(2, col).dataValidation?.formulae?.[0];
      if (!f) return [];
      const [, letra, desde, hasta] = /\$([A-Z])\$(\d+):\$[A-Z]\$(\d+)/.exec(f.split("!")[1]);
      const out = [];
      for (let r = +desde; r <= +hasta; r++) out.push(String(listas.getCell(`${letra}${r}`).value));
      return out;
    };
    const base = { corrales: { nombre: "X", capacidad: 5 }, medicamentos: { nombre: "X", cantidad: 1 }, alimento: { nombre: "X", rubro: "concentrado", cantidad: 1 } }[tipo];
    for (const campo of ["tipo", "uso", "piso", "agua", "rubro"]) {
      for (const v of valoresDe(campo)) {
        const r = validarCatalogo(tipo, [fh(2, { ...base, [campo]: v })], cat());
        assert.deepEqual(r.errores, [], `${tipo}: «${v}» en ${campo}`);
      }
    }
  });
}


// ───────────────────────── Los enlaces de la guía existen ─────────────────────────
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Las rutas que existen en la app: cada carpeta con `page.tsx` o `route.ts` (los grupos «(app)» no cuentan y «[x]» es cualquier valor). */
function rutasDeLaApp(dir = "app", prefijo = "") {
  const rutas = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      const segmento = /^\(.*\)$/.test(nombre) ? "" : `/${nombre}`;
      rutas.push(...rutasDeLaApp(ruta, prefijo + segmento));
    } else if (nombre === "page.tsx" || nombre === "route.ts") rutas.push(prefijo || "/");
  }
  return rutas;
}
// Solo cuentan las rutas fijas: una ruta con «[id]» recibiría cualquier palabra (así «/hato/corrales» caía en la ficha de un animal y decía «no existe»).
// Excepción: los cargues viven en una sola ruta con el tipo en la dirección, y solo valen los tipos que existen.
const existe = (href, rutas) => {
  const camino = href.split("?")[0];
  if (rutas.some((r) => !r.includes("[") && r === camino)) return true;
  const m = /^\/hato\/importar\/historia\/([^/]+)$/.exec(camino);
  return !!m && rutas.includes("/hato/importar/historia/[tipo]") && TIPOS_HISTORIA.includes(m[1]);
};

test("guía de migración: todos los enlaces (botones y alternativas) llevan a una pantalla que existe, con datos y sin ellos", () => {
  const rutas = rutasDeLaApp();
  for (const c of [vacio, { ...vacio, ubicaciones: 5, animales: 10, productosVet: 2, aperturasVet: 2, alimentos: 1, aperturasAlimento: 1 }]) {
    for (const p of pasosMigracion(c, permisosTodos)) {
      assert.ok(existe(p.href, rutas), `${p.id}: ${p.href} no existe`);
      assert.ok(p.alternativa, `${p.id}: toda tarjeta lleva su «Ver…»`);
      assert.match(p.alternativa.texto, /^Ver /, `${p.id}: el enlace secundario siempre empieza por «Ver»`);
      assert.ok(existe(p.alternativa.href, rutas), `${p.id}: ${p.alternativa.href} no existe`);
    }
  }
  for (const h of ["/hato?vista=corrales", "/hato?vista=ceba", "/leche", "/sanidad", "/hato/migrar", "/hato/importar", "/hato/importar/plantilla", "/mas/miembros", "/inventario", "/semaforos", "/hato/corrales/nueva"]) assert.ok(existe(h, rutas), `${h} no existe`);
  assert.equal(existe("/hato/corrales", rutas), false, "esa ruta no existe: era el error");
  assert.equal(existe("/hato/importar/historia/inventado", rutas), false);
});

test("guía de migración: todas las tarjetas se escriben igual (acción «Cargar…», enlace «Ver…», sin repetir lo que dice cada pantalla)", () => {
  for (const c of [vacio, { ...vacio, ubicaciones: 5, animales: 10, pesajes: 3, ordenos: 3, eventosSanitarios: 3, productosVet: 2, aperturasVet: 2, alimentos: 1, aperturasAlimento: 1 }]) {
    for (const p of pasosMigracion(c, permisosTodos)) {
      if (p.porExcel) assert.match(p.accion, /^Cargar /, `${p.id}: ${p.accion}`);
      assert.match(p.alternativa.texto, /^Ver /, p.id);
      assert.doesNotMatch(p.detalle, /plantilla/i, `${p.id}: la plantilla se ofrece dentro de cada pantalla de carga, no en la tarjeta`);
    }
  }
});
