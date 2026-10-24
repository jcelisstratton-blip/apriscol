// Reportes: cálculos puros y cada informe armado con datos de ejemplo (sin base de datos).
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { ETIQUETA_CATEGORIA, bandaCondicion, categoriaAnimal, gananciaDiariaG, mesesEntre } from "../lib/reportes/calculos.ts";
import { avanceGestacion, etapaGestacion, resultadoServicio, servicioPreno, servicioResuelto, situacionDiagnostico } from "../lib/reproduccion.ts";
import { cifra, porcentaje, textoCelda } from "../lib/reportes/formato.ts";
import { FILTRO_ESPECIE, REPORTES, filtrosDe, leerFiltros, reportesVisibles, textoFiltros } from "../lib/reportes/catalogo.ts";
import { ESCENA_FILTRO, ESCENA_REPORTE } from "../lib/escenas-reportes.ts";
import { puedeVer } from "../lib/permisos.ts";
import { construirInventario } from "../lib/reportes/informes/inventario.ts";
import { construirSalidas } from "../lib/reportes/informes/salidas.ts";
import { aptitudServicio, construirVacias } from "../lib/reportes/informes/vacias.ts";
import { construirPorPalpar } from "../lib/reportes/informes/por-palpar.ts";
import { construirGestantes } from "../lib/reportes/informes/gestantes.ts";
import { construirPartos, intervalosEntrePartos } from "../lib/reportes/informes/partos.ts";
import { construirSementales } from "../lib/reportes/informes/sementales.ts";
import { construirOrdeno } from "../lib/reportes/informes/ordeno.ts";
import { construirPeso } from "../lib/reportes/informes/peso.ts";
import { construirRetiro } from "../lib/reportes/informes/retiro.ts";
import { construirSanidad } from "../lib/reportes/informes/sanidad.ts";
import { construirLibroReporte, nombreArchivoReporte } from "../lib/reportes/excel.ts";
import { MAX_FILAS_PANTALLA, limitarFilas } from "../lib/reportes/base.ts";

const hoy = "2026-10-24";
const dias = (a, b) => Math.round((Date.UTC(...b) - Date.UTC(...a)) / 86_400_000);
const animal = (id, extra = {}) => ({ id, numero_arete: id.toUpperCase(), nombre: null, especie: "caprino", sexo: "hembra", estado: "activo", fecha_nacimiento: "2023-01-01", raza_id: null, lote_id: null, vocacion: "leche", uso_macho: null, partos_previos: null, ...extra });
const mapa = (lista) => new Map(lista.map((a) => [a.id, a]));
const valor = (fila, clave) => fila.valores[clave];
const ids = (r) => r.filas.map((f) => f.id);
const indicador = (r, etiqueta) => r.indicadores.find((i) => i.etiqueta === etiqueta)?.valor;

// ───────────────────────── Cálculos ─────────────────────────
test("edad en meses y categoría: cría hasta el destete, levante hasta la edad de servicio, adulto después", () => {
  assert.equal(mesesEntre("2026-08-01", hoy), 2);
  assert.equal(mesesEntre("2026-01-25", hoy), 8, "el mes no se cumple hasta el día del cumpleaños");
  assert.equal(mesesEntre(null, hoy), null);
  const cat = (sexo, nac) => categoriaAnimal({ sexo, fecha_nacimiento: nac }, 10, hoy);
  assert.equal(cat("hembra", "2026-08-01"), "cria");
  assert.equal(cat("hembra", "2026-06-24"), "cria".replace("cria", "levante"), "4 meses cumplidos ya no es cría");
  assert.equal(cat("hembra", "2026-02-01"), "levante");
  assert.equal(cat("hembra", "2025-12-24"), "hembra_adulta", "10 meses exactos ya es adulta");
  assert.equal(cat("macho", "2023-01-01"), "macho_adulto");
  assert.equal(cat("hembra", null), "sin_edad", "sin fecha no se adivina");
  assert.equal(ETIQUETA_CATEGORIA.sin_edad, "Sin fecha de nacimiento");
});

test("gestación: etapa, avance y ventana del diagnóstico", () => {
  assert.equal(etapaGestacion(20, 150, 100), "primer_tercio");
  assert.equal(etapaGestacion(60, 150, 100), "segundo_tercio");
  assert.equal(etapaGestacion(100, 150, 100), "ultimo_tercio", "el último tercio empieza el día de los Ajustes");
  assert.deepEqual(avanceGestacion("2026-07-01", "2026-11-28", hoy), { gestados: 115, total: 150 });
  assert.equal(situacionDiagnostico(30, 45, 60), "pronto");
  assert.equal(situacionDiagnostico(45, 45, 60), "toca");
  assert.equal(situacionDiagnostico(60, 45, 60), "toca");
  assert.equal(situacionDiagnostico(61, 45, 60), "atrasado");
});

test("resultado de un servicio: el parto manda sobre el diagnóstico y lo dudoso queda pendiente", () => {
  assert.equal(resultadoServicio("normal", "vacia"), "parto", "si parió, quedó preñada aunque un diagnóstico dijera otra cosa");
  assert.equal(resultadoServicio("aborto", null), "aborto");
  assert.equal(resultadoServicio(null, "gestante"), "gestante");
  assert.equal(resultadoServicio(null, "vacia"), "vacia");
  assert.equal(resultadoServicio(null, "dudoso"), "pendiente");
  assert.equal(resultadoServicio(null, null), "pendiente");
  assert.equal(servicioResuelto("pendiente"), false);
  assert.equal(servicioPreno("aborto"), true, "abortar es haber quedado preñada");
  assert.equal(servicioPreno("vacia"), false);
});

test("peso: ganancia diaria solo con pesajes separados y bandas de condición corporal", () => {
  assert.equal(gananciaDiariaG({ fecha: "2026-10-10", kg: 40 }, { fecha: "2026-09-10", kg: 38 }), 67);
  assert.equal(gananciaDiariaG({ fecha: "2026-10-20", kg: 6 }, { fecha: "2026-10-10", kg: 5.5 }), 50);
  assert.equal(gananciaDiariaG({ fecha: "2026-10-12", kg: 6 }, { fecha: "2026-10-10", kg: 5 }), null, "dos días no alcanzan para una ganancia confiable");
  assert.equal(gananciaDiariaG({ fecha: "2026-10-12", kg: 6 }, null), null);
  assert.equal(bandaCondicion(2), "baja");
  assert.equal(bandaCondicion(2.5), "adecuada");
  assert.equal(bandaCondicion(3.5), "adecuada");
  assert.equal(bandaCondicion(4), "alta");
});

test("formato a la colombiana: coma decimal, punto de miles y vacío como raya", () => {
  assert.equal(textoCelda({ tipo: "entero" }, 12500), "12.500");
  assert.equal(textoCelda({ tipo: "decimal", decimales: 1 }, 3.6), "3,6");
  assert.equal(textoCelda({ tipo: "porcentaje" }, 0.255), "25,5 %");
  assert.equal(textoCelda({ tipo: "pesos" }, 1250000), "$ 1.250.000");
  assert.match(textoCelda({ tipo: "fecha" }, "2026-10-24"), /^24 .*oct.* 2026$/);
  assert.equal(textoCelda({ tipo: "texto" }, null), "—");
  assert.equal(textoCelda({ tipo: "entero" }, 0), "0", "el cero es un dato, no un vacío");
  assert.equal(porcentaje(1, 3, 1), "33,3 %");
  assert.equal(porcentaje(1, 0), "—", "nunca se divide entre cero");
  assert.equal(cifra(1.5, 2), "1,50");
});

// ───────────────────────── Catálogo ─────────────────────────
test("catálogo: cada reporte y cada opción de filtro tiene su tarjeta, y el valor por defecto es el primero", () => {
  assert.equal(new Set(REPORTES.map((r) => r.id)).size, REPORTES.length, "ids repetidos");
  for (const r of REPORTES) {
    assert.ok(ESCENA_REPORTE[r.id], `falta la escena del reporte ${r.id}`);
    assert.ok(r.vacio.titulo && r.vacio.texto && r.ayuda.length > 0, `${r.id} sin ayuda o sin estado vacío`);
    for (const f of [...r.filtros, FILTRO_ESPECIE]) {
      assert.equal(f.opciones[0].valor, "todos", `${r.id}/${f.clave}: la primera opción es la de por defecto`);
      for (const o of f.opciones) assert.ok(ESCENA_FILTRO[o.valor] && o.escena, `${r.id}/${f.clave}/${o.valor} sin escena`);
    }
  }
});

test("catálogo: un filtro mal escrito vuelve a su valor por defecto y la especie solo se ofrece con las dos", () => {
  const def = REPORTES.find((r) => r.id === "inventario");
  assert.deepEqual(leerFiltros(def, ["caprino", "ovino"], { categoria: "cria", especie: "ovino" }), { especie: "ovino", categoria: "cria" });
  assert.deepEqual(leerFiltros(def, ["caprino", "ovino"], { categoria: "'; drop table", especie: "pez" }), { especie: "todos", categoria: "todos" });
  assert.deepEqual(leerFiltros(def, ["caprino"], { especie: "ovino" }), { categoria: "todos" }, "con una sola especie no hay filtro de especie");
  assert.deepEqual(textoFiltros(def, ["caprino", "ovino"], { especie: "ovino", categoria: "todos" }), ["Especie: Ovejas"]);
  assert.equal(filtrosDe(def, ["caprino"]).length, 1);
});

test("catálogo: cada rol ve los reportes de sus módulos y el plan Cría no ve el peso (es del módulo Carne)", () => {
  const ver = (rol, plan) => reportesVisibles((m) => puedeVer(rol, m, plan)).map((r) => r.id);
  assert.deepEqual(ver("ordenador", "hacienda"), ["inventario", "salidas", "ordeno"]);
  assert.deepEqual(ver("contador", "hacienda"), ["inventario", "salidas", "ordeno", "peso"]);
  assert.equal(ver("veterinario", "hacienda").length, REPORTES.length);
  assert.ok(!ver("propietario", "cria").includes("peso"));
  assert.ok(ver("propietario", "cria").includes("gestantes"));
});

// ───────────────────────── Inventario ─────────────────────────
test("inventario: categorías por edad, orden natural por arete y columnas según lo que la persona ve", () => {
  const animales = [
    animal("a10", { fecha_nacimiento: "2023-01-01" }),
    animal("a2", { fecha_nacimiento: "2023-01-01" }),
    animal("m1", { sexo: "macho", fecha_nacimiento: "2022-05-01", uso_macho: "reproductor" }),
    animal("c1", { fecha_nacimiento: "2026-08-01" }),
    animal("l1", { fecha_nacimiento: "2026-02-01" }),
    animal("s1", { fecha_nacimiento: null }),
  ];
  const base = { hoy, edadServicioMeses: 10, categoria: "todos", dosEspecies: false, animales, razas: new Map(), lotes: new Map(), corrales: null, repro: null, truncado: false };
  const r = construirInventario(base);
  assert.deepEqual(ids(r), ["a2", "a10", "m1", "l1", "c1", "s1"], "adultas, machos, levante, crías y sin fecha; A-2 antes que A-10");
  assert.equal(indicador(r, "Animales activos"), "6");
  assert.equal(indicador(r, "Hembras adultas"), "2");
  assert.equal(indicador(r, "Sin fecha de nacimiento"), "1");
  assert.ok(!r.columnas.some((c) => c.clave === "estado_repro" || c.clave === "corral"), "sin Reproducción ni Corrales no hay esas columnas");
  assert.equal(valor(r.filas[2], "proposito"), "Reproductor");
  assert.equal(valor(r.filas[0], "proposito"), "Leche");

  const solo = construirInventario({ ...base, categoria: "cria" });
  assert.deepEqual(ids(solo), ["c1"]);
  assert.equal(indicador(solo, "Animales activos"), "6", "las cifras de arriba siguen siendo las de todo el hato");

  const conTodo = construirInventario({
    ...base,
    corrales: new Map([["a2", "Potrero 1"]]),
    repro: new Map([["a2", { animal_id: "a2", estado: "gestante", en_lactancia: true, diagnostico: "gestante", fecha_diagnostico: "2026-09-01", ultimo_servicio: "2026-08-01" }]]),
  });
  assert.ok(conTodo.columnas.some((c) => c.clave === "estado_repro") && conTodo.columnas.some((c) => c.clave === "corral"));
  assert.equal(valor(conTodo.filas[0], "estado_repro"), "Gestante");
  assert.equal(valor(conTodo.filas[0], "corral"), "Potrero 1");
});

test("inventario: 800 animales se arman completos y rápido", () => {
  const animales = Array.from({ length: 800 }, (_, i) => animal(`x${i}`, { sexo: i % 5 === 0 ? "macho" : "hembra", fecha_nacimiento: `20${20 + (i % 6)}-0${1 + (i % 9)}-15`, especie: i % 2 ? "ovino" : "caprino" }));
  const t0 = performance.now();
  const r = construirInventario({ hoy, edadServicioMeses: 10, categoria: "todos", dosEspecies: true, animales, razas: new Map(), lotes: new Map(), corrales: null, repro: null, truncado: false });
  assert.equal(r.filas.length, 800);
  assert.equal(new Set(ids(r)).size, 800, "ninguna fila repetida");
  assert.equal(indicador(r, "Cabras"), "400");
  assert.ok(performance.now() - t0 < 500, "debe armarse en menos de medio segundo");
});

// ───────────────────────── Salidas ─────────────────────────
test("salidas: filtra por tipo, no muestra valores sin acceso a las cuentas y suma lo vendido", () => {
  const animales = mapa([animal("a1"), animal("a2", { especie: "ovino" })]);
  const salidas = [
    { id: "b1", animal_id: "a1", tipo: "venta", motivo: "edad", fecha: "2026-10-01", destino: null, comprador: "Don Pedro", peso_kg: 40, valor: 600000, cobrado_en: null, guia_movilizacion: "G-1" },
    { id: "b2", animal_id: "a2", tipo: "muerte", motivo: "sanidad", fecha: "2026-09-01", destino: null, comprador: null, peso_kg: null, valor: null, cobrado_en: null, guia_movilizacion: null },
  ];
  const base = { tipo: "todos", conValores: true, salidas, animales, especie: () => true, truncado: false };
  const r = construirSalidas(base);
  assert.equal(indicador(r, "Valor vendido"), "$ 600.000");
  assert.equal(valor(r.filas[0], "cobro"), "Por cobrar");
  assert.equal(indicador(r, "Muertes"), "1");
  assert.deepEqual(ids(construirSalidas({ ...base, tipo: "muerte" })), ["b2"]);
  const sinCuentas = construirSalidas({ ...base, conValores: false });
  assert.ok(!sinCuentas.columnas.some((c) => c.clave === "valor") && !sinCuentas.indicadores.some((i) => i.etiqueta === "Valor vendido"));
  assert.deepEqual(ids(construirSalidas({ ...base, especie: (a) => a.especie === "ovino" })), ["b2"]);
});

// ───────────────────────── Hembras vacías ─────────────────────────
test("aptitud para el servicio: edad, condición corporal y hembras de edad desconocida", () => {
  assert.deepEqual(aptitudServicio({ meses: 14, partos: 0, cc: null }, 10, 2.5), { apta: true, motivo: null });
  assert.deepEqual(aptitudServicio({ meses: 8, partos: 0, cc: 3 }, 10, 2.5), { apta: false, motivo: "Menor de 10 meses" });
  assert.deepEqual(aptitudServicio({ meses: 30, partos: 2, cc: 2 }, 10, 2.5), { apta: false, motivo: "Condición corporal baja" });
  assert.deepEqual(aptitudServicio({ meses: null, partos: 0, cc: null }, 10, 2.5), { apta: false, motivo: "Falta la fecha de nacimiento" });
  assert.equal(aptitudServicio({ meses: null, partos: 1, cc: null }, 10, 2.5).apta, true, "si ya parió es adulta aunque no se sepa cuándo nació");
});

test("vacías: no lista crías, calcula días abiertos y separa las listas para servicio", () => {
  const animales = mapa([
    animal("v1", { fecha_nacimiento: "2023-01-01" }),
    animal("v2", { fecha_nacimiento: "2026-02-01" }),
    animal("v3", { fecha_nacimiento: "2026-09-01" }),
    animal("g1", { fecha_nacimiento: "2023-01-01" }),
  ]);
  const r = (id, extra) => ({ animal_id: id, estado: "vacia", especie: "caprino", ultimo_parto: null, partos_totales: null, en_lactancia: false, empadronamiento_id: null, empadronamiento_nombre: null, ...extra });
  const repro = [r("v1", { ultimo_parto: "2026-07-26", partos_totales: 2 }), r("v2", { estado: "sin_datos" }), r("v3", { estado: "sin_datos" }), r("g1", { estado: "gestante" })];
  const d = { hoy, situacion: "todos", edadServicioMeses: 10, ccMinima: 2.5, repro, animales, pesos: null, truncado: false };
  const todo = construirVacias(d);
  assert.deepEqual(ids(todo), ["v1", "v2"], "v3 es una cría de menos de 4 meses y g1 está gestante");
  assert.equal(valor(todo.filas[0], "dias_abiertos"), 90);
  assert.equal(indicador(todo, "Listas para servicio"), "1");
  assert.equal(valor(todo.filas[1], "situacion"), "Menor de 10 meses");
  assert.deepEqual(ids(construirVacias({ ...d, situacion: "aptas" })), ["v1"]);
  assert.deepEqual(ids(construirVacias({ ...d, situacion: "sin_datos" })), ["v2"]);
  const conPeso = construirVacias({ ...d, pesos: new Map([["v1", { ultimo_peso_kg: 38, condicion_corporal: 2 }]]) });
  assert.equal(valor(conPeso.filas[0], "situacion"), "Condición corporal baja", "con la condición baja deja de estar lista");
  assert.equal(indicador(conPeso, "Listas para servicio"), "0");
  assert.ok(conPeso.columnas.some((c) => c.clave === "cc"));
});

// ───────────────────────── Por palpar ─────────────────────────
test("por palpar: ventana de diagnóstico, atrasadas primero y diagnósticos dudosos para repetir", () => {
  const animales = mapa(["p1", "p2", "p3", "p4"].map((id) => animal(id)));
  const s = (id, ultimo_servicio, extra = {}) => ({ animal_id: id, estado: "servida", especie: "caprino", ultimo_servicio, servicio_id: `s-${id}`, diagnostico: null, fecha_diagnostico: null, ...extra });
  const repro = [
    s("p1", "2026-09-24"), // 30 días: aún no
    s("p2", "2026-08-25"), // 60 días: toca
    s("p3", "2026-08-01"), // 84 días: atrasada
    s("p4", "2026-09-20", { diagnostico: "dudoso", fecha_diagnostico: "2026-10-06" }), // dudoso hace 18 días: toca repetir
  ];
  const d = { hoy, momento: "todos", ventana: { desde: 45, hasta: 60 }, repro, animales, servicios: new Map(), truncado: false };
  const r = construirPorPalpar(d);
  assert.deepEqual(ids(r), ["p3", "p2", "p4", "p1"]);
  assert.equal(valor(r.filas[0], "situacion"), "Diagnóstico atrasado 24 días");
  assert.equal(valor(r.filas[3], "situacion"), "Faltan 15 días");
  assert.equal(valor(r.filas[2], "situacion"), "Toca repetir el diagnóstico");
  assert.equal(valor(r.filas[1], "desde"), "2026-10-09");
  assert.equal(indicador(r, "Atrasadas"), "1");
  assert.equal(indicador(r, "Para repetir (dudosas)"), "1");
  assert.deepEqual(ids(construirPorPalpar({ ...d, momento: "toca" })), ["p3", "p2", "p4"]);
  assert.deepEqual(ids(construirPorPalpar({ ...d, momento: "pronto" })), ["p1"]);
  assert.deepEqual(ids(construirPorPalpar({ ...d, momento: "repetir" })), ["p4"]);
});

// ───────────────────────── Gestantes ─────────────────────────
test("gestantes: plazo del parto, crías esperadas, último tercio y por secar", () => {
  const animales = mapa(["g1", "g2", "g3"].map((id) => animal(id)));
  const g = (id, ultimo_servicio, fecha_prevista_parto, extra = {}) => ({ animal_id: id, estado: "gestante", especie: "caprino", ultimo_servicio, fecha_prevista_parto, servicio_id: `s-${id}`, en_lactancia: false, ...extra });
  const repro = [g("g1", "2026-07-01", "2026-11-28"), g("g2", "2026-03-01", "2026-07-29"), g("g3", "2026-06-01", "2026-10-29", { en_lactancia: true })];
  const d = { hoy, ventana: "todos", ajustes: { ultimo_tercio_dia: 100, secado_dias_antes_parto: 60 }, repro, animales, servicios: new Map(), fetos: new Map([["s-g1", 2]]), truncado: false };
  const r = construirGestantes(d);
  assert.deepEqual(ids(r), ["g2", "g3", "g1"], "por fecha de parto: la atrasada primero");
  assert.equal(indicador(r, "Gestantes"), "3");
  assert.equal(indicador(r, "Crías esperadas (mínimo)"), "4", "2 de la ecografía y 1 + 1 donde no se contó");
  assert.equal(indicador(r, "Paren en 30 días"), "1");
  assert.equal(indicador(r, "Entre 31 y 60 días"), "1");
  assert.equal(indicador(r, "Atrasadas"), "1");
  assert.equal(indicador(r, "En último tercio"), "2");
  assert.equal(indicador(r, "Por secar"), "1");
  assert.equal(valor(r.filas[1], "nota"), "Por secar");
  assert.equal(valor(r.filas[1], "dias"), 5);
  assert.deepEqual(ids(construirGestantes({ ...d, ventana: "proximos" })), ["g3", "g1"]);
  assert.deepEqual(ids(construirGestantes({ ...d, ventana: "atrasadas" })), ["g2"]);
  assert.deepEqual(ids(construirGestantes({ ...d, ventana: "por_secar" })), ["g3"]);
  assert.deepEqual(ids(construirGestantes({ ...d, ventana: "ultimo_tercio" })), ["g3", "g1"]);
});

// ───────────────────────── Partos ─────────────────────────
test("intervalo entre partos: ignora abortos y no inventa el primero de cada hembra", () => {
  const partos = [
    { id: "p1", madre_id: "m1", fecha: "2025-01-10", tipo: "normal" },
    { id: "p2", madre_id: "m1", fecha: "2025-12-10", tipo: "asistido" },
    { id: "p3", madre_id: "m2", fecha: "2026-03-01", tipo: "normal" },
    { id: "p4", madre_id: "m2", fecha: "2026-06-01", tipo: "aborto" },
    { id: "p5", madre_id: "m1", fecha: "2026-09-05", tipo: "cesarea" },
  ];
  const i = intervalosEntrePartos(partos);
  assert.equal(i.get("p2"), dias([2025, 0, 10], [2025, 11, 10]));
  assert.equal(i.get("p5"), dias([2025, 11, 10], [2026, 8, 5]));
  assert.equal(i.has("p1"), false);
  assert.equal(i.has("p3"), false);
  assert.equal(i.has("p4"), false, "un aborto no tiene intervalo");
});

test("partos del periodo: prolificidad, mortalidad, abortos e intervalo", () => {
  const animales = mapa([animal("m1"), animal("m2")]);
  const p = (id, madre_id, fecha, tipo, extra = {}) => ({ id, madre_id, fecha, tipo, complicaciones: null, causa_aborto: null, asistido_por: null, observaciones: null, ...extra });
  const partos = [p("p1", "m1", "2025-01-10", "normal"), p("p2", "m1", "2025-12-10", "asistido"), p("p3", "m2", "2026-03-01", "normal"), p("p4", "m2", "2026-06-01", "aborto", { causa_aborto: "infecciosa" }), p("p5", "m1", "2026-09-05", "cesarea", { asistido_por: "Dra. Ruiz" })];
  const c = (parto_id, vivo, sexo = "hembra", peso_nacer_kg = null) => ({ parto_id, vivo, sexo, peso_nacer_kg });
  const crias = [c("p1", true), c("p1", true), c("p2", false), c("p3", true, "macho", 3.2), c("p5", true, "macho", 3.0), c("p5", false, "hembra", 2.6)];
  const d = { tipo: "todos", rango: { desde: "2026-01-01", hasta: null }, partos, crias, animales, especie: () => true, hoy, truncado: false };
  const r = construirPartos(d);
  assert.deepEqual(ids(r), ["p5", "p4", "p3"], "los más recientes primero");
  assert.equal(indicador(r, "Partos"), "2");
  assert.equal(indicador(r, "Abortos"), "1");
  assert.equal(indicador(r, "Crías nacidas"), "3");
  assert.equal(indicador(r, "Crías vivas"), "2");
  assert.equal(indicador(r, "Mortalidad al nacer"), "33,3 %");
  assert.equal(indicador(r, "Prolificidad"), "1,50");
  assert.equal(indicador(r, "Partos múltiples"), "50 %");
  assert.equal(indicador(r, "Asistidos o cesáreas"), "50 %");
  assert.equal(indicador(r, "Tasa de abortos"), "33,3 %");
  assert.equal(indicador(r, "Intervalo entre partos"), `${dias([2025, 11, 10], [2026, 8, 5])} días`, "usa el parto anterior aunque sea de otro año");
  assert.equal(valor(r.filas[0], "crias"), 2);
  assert.equal(valor(r.filas[0], "muertas"), 1);
  assert.equal(valor(r.filas[1], "crias"), null, "un aborto no lleva crías");
  assert.equal(valor(r.filas[1], "causa"), "Infecciosa");
  assert.equal(valor(r.filas[0], "peso_nacer"), 2.8);
  assert.deepEqual(ids(construirPartos({ ...d, tipo: "aborto" })), ["p4"]);
  assert.equal(indicador(construirPartos({ ...d, tipo: "aborto" }), "Partos"), "2", "los indicadores son los del periodo, no los del filtro");
  const vacio = construirPartos({ ...d, partos: [], crias: [] });
  assert.equal(indicador(vacio, "Prolificidad"), "—");
  assert.equal(indicador(vacio, "Mortalidad al nacer"), "—");
});

// ───────────────────────── Sementales ─────────────────────────
test("sementales: tasa de preñez solo con servicios resueltos, el parto manda y los de fuera se agrupan por nombre", () => {
  const animales = mapa([animal("m1", { sexo: "macho", nombre: "Trueno" }), ...["h1", "h2", "h3", "h4"].map((id) => animal(id))]);
  const sv = (id, hembra_id, fecha, tipo, extra = {}) => ({ id, hembra_id, fecha, tipo, macho_id: null, macho_externo: null, ...extra });
  const servicios = [
    sv("s1", "h1", "2026-01-05", "monta_natural", { macho_id: "m1" }),
    sv("s2", "h2", "2026-01-06", "monta_natural", { macho_id: "m1" }),
    sv("s3", "h3", "2026-01-07", "inseminacion", { macho_id: "m1" }),
    sv("s4", "h4", "2026-02-01", "monta_natural", { macho_externo: " Toro Ajeno " }),
    sv("s5", "h1", "2026-06-01", "monta_natural", { macho_externo: "toro ajeno" }),
  ];
  const dx = (id, servicio_id, fecha, resultado) => ({ id, hembra_id: "x", servicio_id, fecha, resultado, num_fetos: null });
  const diagnosticos = [dx("d1", "s1", "2026-02-15", "vacia"), dx("d2", "s2", "2026-02-15", "vacia"), dx("d3", "s3", "2026-02-20", "dudoso"), dx("d4", "s4", "2026-03-01", "vacia"), dx("d5", "s4", "2026-03-20", "gestante")];
  const d = {
    tipo: "todos",
    rango: { desde: null, hasta: null },
    servicios,
    diagnosticos,
    partos: [{ id: "pa1", servicio_id: "s1", tipo: "normal" }],
    crias: [{ parto_id: "pa1", vivo: true }, { parto_id: "pa1", vivo: false }],
    animales,
    especie: () => true,
    truncado: false,
  };
  const r = construirSementales(d);
  assert.deepEqual(ids(r), ["id:m1", "ext:toro ajeno"], "los de fuera se agrupan sin importar mayúsculas ni espacios");
  const m1 = r.filas[0].valores;
  assert.equal(m1.servicios, 3);
  assert.equal(m1.pendientes, 1, "el diagnóstico dudoso no cuenta");
  assert.equal(m1.prenados, 1, "s1 parió aunque su diagnóstico decía vacía");
  assert.equal(m1.tasa, 0.5);
  assert.equal(m1.partos, 1);
  assert.equal(m1.crias, 2);
  assert.equal(m1.vivas, 1);
  assert.equal(m1.prolificidad, 2);
  assert.equal(m1.mortalidad, 0.5);
  assert.equal(r.filas[0].titulo, "Trueno · M1");
  assert.equal(r.filas[0].href, "/hato/m1");
  const ext = r.filas[1].valores;
  assert.equal(ext.origen, "De fuera");
  assert.equal(ext.tasa, 1, "el último diagnóstico de s4 es gestante");
  assert.equal(ext.prolificidad, null);
  assert.equal(indicador(r, "Preñez · Monta natural"), "67 %");
  assert.equal(indicador(r, "Preñez · Inseminación"), "—", "sin resultados no hay tasa");
  assert.ok(r.notas.some((n) => /no es confiable/.test(n)));
  assert.deepEqual(ids(construirSementales({ ...d, tipo: "inseminacion" })), ["id:m1"]);
  assert.equal(indicador(construirSementales({ ...d, rango: { desde: "2026-05-01", hasta: null } }), "Servicios"), "1");
});

// ───────────────────────── Ordeño ─────────────────────────
test("ordeño: en ordeño, secas, hembras de carne que alguna vez ordeñaron y por secar", () => {
  const animales = [animal("h1"), animal("h2"), animal("h3", { vocacion: "carne" }), animal("h4", { vocacion: "carne" }), animal("m1", { sexo: "macho" })];
  const lac = (animal_id, numero, fecha_parto, fecha_secado, extra = {}) => ({ animal_id, numero, fecha_parto, fecha_secado, dias_lactancia: null, litros_total: null, pico_diario: null, ...extra });
  const d = {
    hoy,
    situacion: "todos",
    secadoDiasAntes: 60,
    animales,
    lactancias: [lac("h1", 1, "2025-05-01", "2025-11-01"), lac("h1", 2, "2026-06-01", null, { dias_lactancia: 145, pico_diario: 3.5, litros_total: 400 }), lac("h2", 1, "2026-01-01", "2026-09-01"), lac("h4", 1, "2026-02-01", "2026-08-01")],
    produccion: new Map([["h1", { litros_tanque: 60, litros_descartados: 6, dias: 20 }]]),
    repro: new Map([["h1", { animal_id: "h1", estado: "gestante", fecha_prevista_parto: "2026-12-20" }]]),
    truncado: false,
  };
  const r = construirOrdeno(d);
  assert.deepEqual(ids(r), ["h1", "h2", "h4"], "h3 es de carne y nunca ordeñó; el macho no cuenta");
  assert.equal(valor(r.filas[0], "situacion"), "Por secar");
  assert.equal(valor(r.filas[0], "lactancia"), 2, "cuenta la lactancia más reciente");
  assert.equal(valor(r.filas[0], "litros"), 66);
  assert.ok(Math.abs(valor(r.filas[0], "promedio") - 3.3) < 1e-9);
  assert.equal(valor(r.filas[1], "dias_secas"), dias([2026, 8, 1], [2026, 9, 24]));
  assert.equal(indicador(r, "En ordeño"), "1");
  assert.equal(indicador(r, "Secas"), "2");
  assert.equal(indicador(r, "Por secar"), "1");
  assert.deepEqual(ids(construirOrdeno({ ...d, situacion: "seca" })), ["h2", "h4"]);
  assert.deepEqual(ids(construirOrdeno({ ...d, situacion: "por_secar" })), ["h1"]);
  const sinRepro = construirOrdeno({ ...d, repro: null });
  assert.ok(!sinRepro.indicadores.some((i) => i.etiqueta === "Por secar"), "sin Reproducción no se sabe quién está gestante");
});

// ───────────────────────── Peso ─────────────────────────
test("peso: alertas por gravedad, ganancia solo en crías y levante, y nunca pesados", () => {
  const animales = [animal("a1"), animal("a2", { fecha_nacimiento: "2026-08-01" }), animal("a3"), animal("a4"), animal("a5")];
  const peso = (animal_id, ultima_fecha, ultimo_peso_kg, anterior_fecha, anterior_peso_kg, condicion_corporal = null) => ({ animal_id, ultima_fecha, ultimo_peso_kg, anterior_fecha, anterior_peso_kg, condicion_corporal, fecha_condicion: condicion_corporal ? ultima_fecha : null, pesajes: 2 });
  const d = {
    hoy,
    alerta: "todos",
    edadServicioMeses: 10,
    gdpMinimaG: 100,
    animales,
    pesos: new Map([
      ["a1", peso("a1", "2026-10-10", 40, "2026-09-10", 38, 3)],
      ["a2", peso("a2", "2026-10-20", 6, "2026-10-10", 5.5)],
      ["a4", peso("a4", "2026-06-20", 30, null, null)],
      ["a5", peso("a5", "2026-10-15", 35, null, null, 2)],
    ]),
    truncado: false,
  };
  const r = construirPeso(d);
  assert.deepEqual(ids(r), ["a5", "a2", "a3", "a4", "a1"]);
  assert.equal(valor(r.filas[4], "gdp"), 67, "una adulta con 67 g/día no se marca: solo crecen las crías");
  assert.equal(valor(r.filas[4], "alerta"), "Al día");
  assert.equal(valor(r.filas[1], "gdp"), 50);
  assert.equal(valor(r.filas[1], "alerta"), "Crece poco");
  assert.equal(valor(r.filas[3], "dias_sin_pesar"), dias([2026, 5, 20], [2026, 9, 24]));
  assert.equal(valor(r.filas[2], "alerta"), "Nunca se ha pesado");
  assert.equal(indicador(r, "Con pesaje"), "4");
  assert.equal(indicador(r, "Flacos"), "1");
  assert.deepEqual(ids(construirPeso({ ...d, alerta: "gdp_baja" })), ["a2"]);
  assert.deepEqual(ids(construirPeso({ ...d, alerta: "sin_pesaje" })), ["a3"]);
  assert.deepEqual(ids(construirPeso({ ...d, alerta: "sin_pesar" })), ["a4"]);
});

// ───────────────────────── Retiro ─────────────────────────
test("retiro: solo lo vigente, con el tratamiento que más lo alarga y los que quedan libres pronto", () => {
  const animales = mapa([animal("r1"), animal("r2"), animal("r3")]);
  const ev = (animal_id, fecha, producto_nombre, fin_retiro_leche, fin_retiro_carne) => ({ animal_id, fecha, tipo: "tratamiento", producto_nombre, diagnostico: null, fin_retiro_leche, fin_retiro_carne });
  const d = {
    hoy,
    tipo: "todos",
    retiros: [
      { animal_id: "r1", retiro_leche_hasta: "2026-10-30", retiro_carne_hasta: "2026-11-10" },
      { animal_id: "r2", retiro_leche_hasta: "2026-10-20", retiro_carne_hasta: null },
      { animal_id: "r3", retiro_leche_hasta: null, retiro_carne_hasta: "2026-10-27" },
    ],
    eventos: [ev("r1", "2026-10-20", "Oxitetraciclina", "2026-10-30", "2026-11-10"), ev("r1", "2026-10-15", "Ivermectina", "2026-10-25", null)],
    animales,
    especie: () => true,
    truncado: false,
  };
  const r = construirRetiro(d);
  assert.deepEqual(ids(r), ["r3", "r1"], "el que sale primero va primero; r2 ya terminó");
  assert.equal(valor(r.filas[1], "tratamiento"), "Oxitetraciclina");
  assert.equal(valor(r.filas[1], "situacion"), "Leche y carne");
  assert.equal(valor(r.filas[0], "carne_dias"), 3);
  assert.equal(valor(r.filas[0], "leche_dias"), null);
  assert.equal(indicador(r, "Animales en retiro"), "2");
  assert.equal(indicador(r, "Leche retenida"), "1");
  assert.equal(indicador(r, "Carne retenida"), "2");
  assert.equal(indicador(r, "Quedan libres en 7 días"), "1");
  assert.deepEqual(ids(construirRetiro({ ...d, tipo: "leche" })), ["r1"]);
});

// ───────────────────────── Sanidad pendiente ─────────────────────────
test("sanidad pendiente: dosis, FAMACHA, podología y pediluvio, lo más urgente primero", () => {
  const animales = mapa(["z1", "z2", "z3", "z4", "z5"].map((id) => animal(id)));
  const d = {
    hoy,
    tipo: "todos",
    podologiaCadaDias: 120,
    pediluvioCadaDias: 30,
    dosis: [
      { animal_id: "z1", evento_id: "e1", producto_nombre: "Clostridial", proxima_fecha: "2026-10-20", tipo: "vacunacion" },
      { animal_id: "z2", evento_id: "e1", producto_nombre: "Clostridial", proxima_fecha: "2026-11-01", tipo: "vacunacion" },
      { animal_id: "z3", evento_id: "e1", producto_nombre: "Clostridial", proxima_fecha: "2027-01-01", tipo: "vacunacion" },
    ],
    famacha: [
      { animal_id: "z1", puntaje: 4, ultima_fecha: "2026-10-10", desparasitado_en: null },
      { animal_id: "z2", puntaje: 3, ultima_fecha: "2026-10-10", desparasitado_en: null },
      { animal_id: "z3", puntaje: 5, ultima_fecha: "2026-10-10", desparasitado_en: "2026-10-12" },
    ],
    podologia: [
      { animal_id: "z1", ultima_fecha: "2026-01-01" },
      { animal_id: "z4", ultima_fecha: null },
      { animal_id: "z5", ultima_fecha: "2026-10-01" },
    ],
    pediluvio: [{ animal_id: "z5", ultima_fecha: "2026-10-01" }],
    animales,
    especie: () => true,
    truncado: false,
  };
  const r = construirSanidad(d);
  assert.equal(r.filas.length, 6, "2 dosis + 2 FAMACHA + 2 podologías; la dosis lejana, el FAMACHA tratado y los que están al día no salen");
  assert.equal(r.filas[0].id, "dosis:z1:e1", "la dosis vencida va primero");
  assert.equal(valor(r.filas[0], "situacion"), "Vencida hace 4 días");
  assert.equal(r.filas[1].id, "famacha:z1");
  assert.equal(indicador(r, "Dosis vencidas"), "1");
  assert.equal(indicador(r, "FAMACHA por desparasitar"), "1");
  assert.equal(indicador(r, "Podología atrasada"), "2");
  assert.equal(indicador(r, "Pediluvio atrasado"), "0");
  const nunca = r.filas.find((f) => f.id === "podologia:z4");
  assert.equal(valor(nunca, "situacion"), "Nunca se ha hecho");
  assert.deepEqual(ids(construirSanidad({ ...d, tipo: "famacha" })), ["famacha:z1", "famacha:z2"]);
});

// ───────────────────────── Excel ─────────────────────────
test("Excel: fechas y números de verdad, formatos, filtros y hoja de indicadores", async () => {
  const resultado = {
    columnas: [
      { clave: "arete", titulo: "Arete", tipo: "texto", ancho: 12, soloExcel: true },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha", ancho: 14 },
      { clave: "n", titulo: "Crías", tipo: "entero", ancho: 8 },
      { clave: "kg", titulo: "Peso", tipo: "decimal", ancho: 10, decimales: 2 },
      { clave: "tasa", titulo: "Tasa", tipo: "porcentaje", ancho: 10 },
      { clave: "nota", titulo: "Nota", tipo: "texto", ancho: 20 },
    ],
    filas: [
      { id: "1", titulo: "Luna · A-1", valores: { arete: "A-1", fecha: "2026-10-24", n: 2, kg: 3.25, tasa: 0.25, nota: "Todo bien" } },
      { id: "2", titulo: "B-2", valores: { arete: "B-2", fecha: null, n: 0, kg: null, tasa: null, nota: null } },
    ],
    indicadores: [{ etiqueta: "Partos", valor: "2", detalle: "En el periodo" }],
    notas: ["Una nota"],
  };
  const buf = await construirLibroReporte({ def: { titulo: "Partos del periodo" }, finca: "El Aprisco", resultado, periodo: { texto: "este año", desde: "2026-01-01", hasta: null }, filtros: ["Tipo: Cesáreas"], hoy, generado: new Date("2026-10-24T12:00:00Z") });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("Partos del periodo");
  assert.equal(ws.getCell("A1").value, "El Aprisco");
  assert.match(ws.getCell("A3").value, /Periodo: del 01\/01\/2026 al 24\/10\/2026 \(este año\)/);
  assert.match(ws.getCell("A4").value, /Tipo: Cesáreas/);
  assert.equal(ws.getRow(7).getCell(1).value, "Arete", "el Excel lleva las columnas que en pantalla van en el título");
  const f = ws.getRow(8);
  assert.ok(f.getCell(2).value instanceof Date, "una fecha es una fecha, no un texto");
  assert.equal(f.getCell(2).numFmt, "dd/mm/yyyy");
  assert.equal(f.getCell(3).value, 2);
  assert.equal(f.getCell(4).numFmt, "#,##0.00");
  assert.equal(f.getCell(5).value, 0.25);
  assert.equal(f.getCell(5).numFmt, "0.0%");
  assert.equal(ws.getRow(9).getCell(2).value, null, "sin dato queda vacío, no cero ni raya");
  assert.equal(ws.getRow(9).getCell(3).value, 0, "el cero es un dato");
  assert.ok(ws.autoFilter, "con filtros para ordenar y buscar en Excel");
  const hi = wb.getWorksheet("Indicadores");
  assert.equal(hi.getCell("A4").value, "Partos");
  assert.equal(hi.getCell("B4").value, "2");
  assert.equal(nombreArchivoReporte("Finca: La/Loma", "Partos del periodo", hoy), "Finca- La-Loma - Partos del periodo - 2026-10-24.xlsx");
});

test("pantalla: con miles de filas se muestran las primeras con un aviso y las cifras siguen siendo las de todo; con pocas no cambia nada", () => {
  const filas = Array.from({ length: 3500 }, (_, i) => ({ id: `f${i}`, titulo: `A-${i}`, valores: {} }));
  const completo = { columnas: [], filas, indicadores: [{ etiqueta: "Animales activos", valor: "3.500" }], notas: ["otra nota"] };
  const r = limitarFilas(completo);
  assert.equal(r.filas.length, MAX_FILAS_PANTALLA);
  assert.equal(r.filas[0].id, "f0", "se quedan las primeras: las más importantes");
  assert.match(r.notas[0], /primeras 2\.000 de 3\.500 filas/);
  assert.equal(r.notas[1], "otra nota", "las notas que ya había se conservan");
  assert.equal(r.indicadores[0].valor, "3.500");
  assert.equal(completo.filas.length, 3500, "el resultado completo (el del Excel) no se toca");
  const poco = { ...completo, filas: filas.slice(0, 50) };
  assert.equal(limitarFilas(poco), poco);
});
