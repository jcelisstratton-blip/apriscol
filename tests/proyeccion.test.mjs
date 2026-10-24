import test from "node:test";
import assert from "node:assert/strict";
import { simular, porAnio, descuadreBalance } from "../lib/proyeccion/motor.ts";
import { REFERENCIAS, limpiarAjustes, aplicarAjustes, DEFINICIONES } from "../lib/proyeccion/supuestos.ts";

const inicio = (extra = {}) => ({
  vientres: 50,
  sementales: 2,
  lactantes: 15,
  cohortes: [
    { edad: 1, machos: 4, hembras: 4 },
    { edad: 4, machos: 6, hembras: 5 },
    { edad: 9, machos: 2, hembras: 6 },
  ],
  gestantesPorMes: [10, 8, 6, 4, 2],
  servidasPorMes: [0, 2, 3, 3, 2],
  ...extra,
});

test("supuestos: todas las referencias están dentro de su propio rango", () => {
  for (const d of DEFINICIONES) assert.ok(d.referencia >= d.min && d.referencia <= d.max, d.clave);
});

test("limpiarAjustes: descarta claves desconocidas, fuera de rango y lo que no es número", () => {
  const l = limpiarAjustes({ precio_kg_vivo: 12000, prolificidad: 9, inventada: 1, peso_venta_kg: "35", destete_meses: NaN });
  assert.deepEqual(l, { precio_kg_vivo: 12000 });
  assert.deepEqual(limpiarAjustes(null), {});
  assert.deepEqual(limpiarAjustes([1, 2]), {});
});

test("aplicarAjustes: el ajuste gana sobre la base", () => {
  assert.equal(aplicarAjustes(REFERENCIAS, { prolificidad: 1.8 }).prolificidad, 1.8);
});

test("balance: animales finales = iniciales + nacimientos − muertes − ventas, mes a mes y en 36 meses", () => {
  for (const h of [12, 24, 36]) {
    const p = simular(inicio(), REFERENCIAS, h);
    assert.equal(p.meses.length, h);
    assert.ok(descuadreBalance(p) < 1e-6, `descuadre ${descuadreBalance(p)}`);
  }
});

test("balance: también cierra con crecimiento, poca retención y capacidad", () => {
  const s = { ...REFERENCIAS, crecimiento_hato_pct: 40, retencion_hembras_pct: 5, capacidad_max_animales: 80, mortalidad_levante_pct: 10 };
  assert.ok(descuadreBalance(simular(inicio(), s, 36)) < 1e-6);
});

test("sin hato no hay nada que proyectar y nada se rompe", () => {
  const p = simular({ vientres: 0, sementales: 0, lactantes: 0, cohortes: [], gestantesPorMes: [], servidasPorMes: [] }, REFERENCIAS, 12);
  assert.equal(p.meses.at(-1).total, 0);
  assert.equal(p.meses.at(-1).ingresos, 0);
  assert.ok(p.meses.every((m) => Number.isFinite(m.flujo)));
});

test("partos: los primeros meses salen de las fechas previstas y después de la tasa de la finca", () => {
  const p = simular(inicio(), { ...REFERENCIAS, prenez_servidas_pct: 100 }, 12, 150);
  assert.equal(p.partosDesdeRegistro, true);
  assert.equal(p.meses[0].partos, 10);
  assert.equal(p.meses[1].partos, 10); // 8 gestantes + 2 servidas
  // pasada la gestación (5 meses) rige la tasa: vientres × 1,5 / 12
  const m6 = p.meses[5];
  const previos = p.meses[4].vientres;
  assert.ok(Math.abs(m6.partos - previos * (1.5 / 12)) < 1e-9);
});

test("partos: con casi nada registrado se usa la tasa de la finca desde el primer mes", () => {
  const p = simular(inicio({ gestantesPorMes: [1], servidasPorMes: [] }), REFERENCIAS, 12);
  assert.equal(p.partosDesdeRegistro, false);
  assert.ok(Math.abs(p.meses[0].partos - 50 * 1.5 / 12) < 1e-9);
  assert.ok(p.avisos.some((a) => a.tipo === "partos"));
});

test("más prolificidad, más nacimientos y más ventas", () => {
  const a = simular(inicio(), REFERENCIAS, 24);
  const b = simular(inicio(), { ...REFERENCIAS, prolificidad: 1.8 }, 24);
  assert.ok(porAnio(b)[1].nacimientos > porAnio(a)[1].nacimientos);
  assert.ok(porAnio(b)[1].ingresosCarne > porAnio(a)[1].ingresosCarne);
});

test("sin retención el hato reproductor se acaba de reducir y avisa", () => {
  const p = simular(inicio({ cohortes: [] }), { ...REFERENCIAS, retencion_hembras_pct: 0 }, 36);
  assert.ok(p.meses.at(-1).vientres < 50);
  assert.ok(p.avisos.some((a) => a.tipo === "reemplazo"));
});

test("el hato reproductor crece hacia su objetivo cuando hay reemplazos suficientes", () => {
  const p = simular(inicio(), { ...REFERENCIAS, crecimiento_hato_pct: 20, retencion_hembras_pct: 60 }, 36);
  const objetivo = 50 * Math.pow(1.2, 3);
  assert.ok(Math.abs(p.meses.at(-1).vientres - objetivo) < 1, `${p.meses.at(-1).vientres} vs ${objetivo}`);
});

test("capacidad: avisa el primer mes en que no caben", () => {
  const p = simular(inicio(), { ...REFERENCIAS, capacidad_max_animales: 60 }, 24);
  const a = p.avisos.find((x) => x.tipo === "capacidad");
  assert.ok(a);
  assert.ok(p.meses[a.mes - 1].total > 60);
  assert.ok(a.mes === 1 || p.meses[a.mes - 2].total <= 60);
  assert.ok(!simular(inicio(), { ...REFERENCIAS, capacidad_max_animales: 0 }, 24).avisos.some((x) => x.tipo === "capacidad"));
});

test("leche: sin ordeño no hay litros; con ordeño suben con las lactantes", () => {
  const sin = simular(inicio(), { ...REFERENCIAS, hembras_ordenadas_pct: 0 }, 12);
  assert.equal(sin.meses.reduce((a, m) => a + m.litros, 0), 0);
  const con = simular(inicio(), { ...REFERENCIAS, hembras_ordenadas_pct: 100 }, 12);
  assert.ok(con.meses[0].litros > 0);
  // el primer mes: las 15 lactantes de hoy (que se van secando) más los partos del mes
  assert.ok(con.meses[0].lactantes <= 50);
});

test("leche y carne se pueden separar: los ingresos suman y cada línea no depende de la otra", () => {
  const p = simular(inicio(), REFERENCIAS, 24);
  for (const m of p.meses) assert.ok(Math.abs(m.ingresos - (m.ingresosCarne + m.ingresosLeche)) < 1e-6);
  const sinLeche = simular(inicio(), { ...REFERENCIAS, hembras_ordenadas_pct: 0 }, 24);
  assert.ok(Math.abs(porAnio(p)[0].ingresosCarne - porAnio(sinLeche)[0].ingresosCarne) < 1e-6);
});

test("dinero: flujo = ingresos − costos y los costos suman sus partes", () => {
  const p = simular(inicio(), REFERENCIAS, 12);
  for (const m of p.meses) {
    assert.ok(Math.abs(m.flujo - (m.ingresos - m.costos)) < 1e-6);
    assert.ok(Math.abs(m.costos - (m.costoAlimento + m.costoAnimales + m.costoFijos)) < 1e-6);
    assert.ok(m.costoAlimentoCeba + m.costoAlimentoLactancia <= m.costoAlimento + 1e-6);
  }
});

test("alimento: toneladas × costo por kilo = costo de alimentación", () => {
  const p = simular(inicio(), REFERENCIAS, 12);
  for (const m of p.meses) assert.ok(Math.abs(m.msTotal * 1000 * REFERENCIAS.costo_kg_ms - m.costoAlimento) < 1e-3);
});

test("porAnio: bloques de 12 meses y sumas coherentes", () => {
  const p = simular(inicio(), REFERENCIAS, 30);
  const b = porAnio(p);
  assert.equal(b.length, 3);
  assert.equal(b[2].hasta - b[2].desde + 1, 6);
  assert.ok(Math.abs(b.reduce((a, x) => a + x.flujo, 0) - p.meses.reduce((a, m) => a + m.flujo, 0)) < 1e-3);
});

test("una gestación más larga atrasa el momento en que rige la tasa", () => {
  const corta = simular(inicio(), { ...REFERENCIAS, prenez_servidas_pct: 100 }, 12, 150);
  const larga = simular(inicio({ gestantesPorMes: [10, 8, 6, 4, 2, 1], servidasPorMes: [0, 2, 3, 3, 2, 0] }), { ...REFERENCIAS, prenez_servidas_pct: 100 }, 12, 160);
  assert.equal(corta.meses[5].partos === larga.meses[5].partos, false);
});

import { formatear, etiquetaMes, columnasDinero, columnasHato, columnasAlimento, lineasResumen, ENFOQUES } from "../lib/proyeccion/vista.ts";

test("vista: números a la colombiana y signos", () => {
  assert.equal(formatear("n0", 1234567), "1.234.567");
  assert.equal(formatear("n1", 3.64), "3,6");
  assert.equal(formatear("pesos", 2500000), "$ 2.500.000");
  assert.equal(formatear("pesos", -1500), "−$ 1.500");
  assert.equal(formatear("pesos", -0.2), "$ 0");
  assert.equal(formatear("ton", 1.256), "1,26 t");
});

test("vista: el mes 1 es el que sigue al de hoy, también al cambiar de año", () => {
  assert.equal(etiquetaMes("2026-10-24", 1), "nov 2026");
  assert.equal(etiquetaMes("2026-10-24", 3), "ene 2027");
  assert.equal(etiquetaMes("2026-12-31", 12), "dic 2027");
  assert.equal(etiquetaMes("2026-01-01", 24), "ene 2028");
});

test("vista: carne y leche se consultan por separado y 'todo' suma las dos líneas", () => {
  const p = simular(inicio(), { ...REFERENCIAS, hembras_ordenadas_pct: 100 }, 24);
  const [a1] = porAnio(p);
  const lineas = Object.fromEntries(ENFOQUES.map((e) => [e, lineasResumen(e)]));
  const valor = (e, titulo) => lineas[e].find((l) => l.titulo === titulo).valor(a1);
  assert.equal(valor("carne", "Ingresos por carne"), a1.ingresosCarne);
  assert.equal(valor("leche", "Ingresos por leche"), a1.ingresosLeche);
  assert.ok(Math.abs(valor("todo", "Ingresos por carne") + valor("todo", "Ingresos por leche") - a1.ingresos) < 1e-3);
  // Las columnas de cada enfoque se evalúan sin NaN en todos los meses
  for (const e of ENFOQUES) for (const col of [...columnasHato(e), ...columnasAlimento(e), ...columnasDinero(e)]) for (const m of p.meses) assert.ok(Number.isFinite(col.valor(m)), `${e}/${col.clave}`);
  const todo = columnasDinero("todo");
  for (const m of p.meses) assert.ok(Math.abs(todo.find((x) => x.clave === "flujo").valor(m) - m.flujo) < 1e-6);
});

import { armarBase, edadMeses } from "../lib/proyeccion/base.ts";

const HOY = "2026-10-24";
const animalesBase = () => {
  const lista = [];
  for (let i = 0; i < 20; i++) lista.push({ id: `h${i}`, sexo: "hembra", estado: "activo", fecha_nacimiento: "2022-01-10", uso_macho: null });
  lista.push({ id: "m1", sexo: "macho", estado: "activo", fecha_nacimiento: "2021-05-01", uso_macho: "reproductor" });
  lista.push({ id: "m2", sexo: "macho", estado: "activo", fecha_nacimiento: "2026-07-01", uso_macho: null }); // 3 meses
  lista.push({ id: "c1", sexo: "hembra", estado: "activo", fecha_nacimiento: "2026-09-20", uso_macho: null }); // 1 mes
  lista.push({ id: "v1", sexo: "hembra", estado: "activo", fecha_nacimiento: "2026-02-01", uso_macho: null }); // 8 meses
  lista.push({ id: "x1", sexo: "hembra", estado: "vendido", fecha_nacimiento: "2020-01-01", uso_macho: null });
  return lista;
};
const datos = (extra = {}) => ({
  hoy: HOY,
  animales: animalesBase(),
  repro: [],
  partos: [],
  bajas: [],
  lactancias: [],
  produccion: { litros: 0, registros: 0 },
  costosPorRubro: [],
  mesesConCostos: 0,
  litros12m: 0,
  ingresosLeche12m: 0,
  capacidad: 0,
  gestacionDias: 150,
  servicioEdadMinMeses: 10,
  pesoAdultoHembraKg: null,
  ...extra,
});

test("base: edad en meses y hato de hoy por categoría (los dados de baja no cuentan)", () => {
  assert.equal(edadMeses("2026-09-20", HOY), 1);
  assert.equal(edadMeses(null, HOY), null);
  const b = armarBase(datos());
  assert.equal(b.inicio.vientres, 20);
  assert.equal(b.inicio.sementales, 1);
  assert.equal(b.hato.crias, 1);
  assert.equal(b.hato.levante, 2);
  assert.equal(b.hato.total, 24);
});

test("base: sin datos suficientes todo queda en su valor de referencia", () => {
  const b = armarBase(datos());
  for (const k of ["partos_por_hembra_anio", "prolificidad", "precio_kg_vivo", "costo_kg_ms", "litros_dia"]) {
    assert.equal(b.procedencia[k].origen, "referencia", k);
    assert.equal(b.base[k], REFERENCIAS[k], k);
  }
});

test("base: con muestra suficiente toma el valor de la finca y dice de cuántos datos sale", () => {
  const partos = Array.from({ length: 30 }, (_, i) => ({ tipo: i === 0 ? "aborto" : "normal", numero_crias: i % 2 === 0 ? 2 : 1 }));
  const b = armarBase(datos({ partos }));
  assert.equal(b.procedencia.partos_por_hembra_anio.origen, "finca");
  assert.equal(b.base.partos_por_hembra_anio, 1.45); // 29 partos (sin el aborto) / 20 reproductoras
  assert.match(b.procedencia.partos_por_hembra_anio.muestra, /29 partos/);
  assert.equal(b.procedencia.prolificidad.origen, "finca");
  assert.ok(b.base.prolificidad > 1 && b.base.prolificidad < 2);
});

test("base: el valor de la finca nunca sale de su rango", () => {
  const partos = Array.from({ length: 100 }, () => ({ tipo: "normal", numero_crias: 2 }));
  const b = armarBase(datos({ partos })); // 100 partos / 20 = 5 por hembra: se recorta al máximo permitido
  assert.equal(b.base.partos_por_hembra_anio, 2.5);
});

test("base: precio, peso y edad de venta salen de las ventas reales de animales jóvenes", () => {
  const animales = [...animalesBase()];
  const bajas = [];
  for (let i = 0; i < 6; i++) {
    animales.push({ id: `j${i}`, sexo: "macho", estado: "vendido", fecha_nacimiento: "2026-01-01", uso_macho: null });
    bajas.push({ animal_id: `j${i}`, tipo: "venta", fecha: "2026-07-05", peso_kg: 30 + i, valor: (30 + i) * 12000 });
  }
  const b = armarBase(datos({ animales, bajas }));
  assert.equal(b.procedencia.precio_kg_vivo.origen, "finca");
  assert.equal(b.base.precio_kg_vivo, 12000);
  assert.equal(b.base.peso_venta_kg, 32.5);
  assert.equal(b.base.edad_venta_meses, 6);
});

test("base: los costos se vuelven costo por kilo de alimento, por animal y fijos mensuales", () => {
  const costosPorRubro = [
    { rubro: "concentrado", total: 6_000_000 },
    { rubro: "vacunas_desparasitantes", total: 1_200_000 },
    { rubro: "mano_obra", total: 12_000_000 },
    { rubro: "compra_animales", total: 9_000_000 },
  ];
  const b = armarBase(datos({ costosPorRubro, mesesConCostos: 12 }));
  assert.equal(b.procedencia.costo_kg_ms.origen, "finca");
  assert.equal(b.base.costos_fijos_mes, 1_000_000); // la compra de animales no es costo fijo
  assert.equal(b.base.costo_animal_mes, Math.round(1_200_000 / 12 / 24));
  // con menos de tres meses de costos no se aprende nada
  assert.equal(armarBase(datos({ costosPorRubro, mesesConCostos: 2 })).procedencia.costos_fijos_mes.origen, "referencia");
});

test("base: las preñeces registradas caen en el mes en que paren", () => {
  const repro = [
    { animal_id: "h0", estado: "gestante", fecha_prevista_parto: "2026-11-10", ultimo_servicio: null, en_lactancia: false },
    { animal_id: "h1", estado: "gestante", fecha_prevista_parto: "2027-01-10", ultimo_servicio: null, en_lactancia: true },
    { animal_id: "h2", estado: "servida", fecha_prevista_parto: "2027-02-20", ultimo_servicio: "2026-09-20", en_lactancia: false },
    { animal_id: "x1", estado: "gestante", fecha_prevista_parto: "2026-11-10", ultimo_servicio: null, en_lactancia: false }, // dada de baja: no cuenta
  ];
  const b = armarBase(datos({ repro }));
  assert.equal(b.inicio.gestantesPorMes.reduce((a, x) => a + x, 0), 2);
  assert.equal(b.inicio.servidasPorMes.reduce((a, x) => a + x, 0), 1);
  assert.equal(b.inicio.lactantes, 1);
  assert.equal(b.inicio.gestantesPorMes[0], 1);
});

test("base → simulador: con los datos armados la proyección cierra el balance", () => {
  const b = armarBase(datos());
  assert.ok(descuadreBalance(simular(b.inicio, b.base, 36, b.gestacionDias)) < 1e-6);
});

import { correr, totales, sensibilidad, equilibrio, rango } from "../lib/proyeccion/analisis.ts";

const entrada = (extra = {}) => ({ inicio: inicio(), horizonte: 24, gestacionDias: 150, ...extra });

test("época seca: encarece el alimento y baja la leche solo en los meses sin lluvia, y el balance sigue cerrando", () => {
  const s = { ...REFERENCIAS, hembras_ordenadas_pct: 100 };
  const estacion = { mesHoy: 10, mesesLluvia: [4, 5, 10, 11] };
  const con = simular(inicio(), s, 12, 150, estacion);
  const sin = simular(inicio(), s, 12, 150);
  assert.ok(descuadreBalance(con) < 1e-6);
  con.meses.forEach((m, i) => {
    const mesCal = ((10 - 1 + m.n) % 12) + 1;
    assert.equal(m.seco, ![4, 5, 10, 11].includes(mesCal));
    const k = sin.meses[i];
    if (m.seco) {
      assert.ok(Math.abs(m.costoAlimento - k.costoAlimento * 1.15) < 1e-3);
      assert.ok(Math.abs(m.litros - k.litros * 0.9) < 1e-6);
    } else {
      assert.ok(Math.abs(m.costoAlimento - k.costoAlimento) < 1e-6);
      assert.ok(Math.abs(m.litros - k.litros) < 1e-6);
    }
  });
});

test("época seca: sin meses de lluvia definidos no cambia nada", () => {
  const a = simular(inicio(), REFERENCIAS, 12, 150, { mesHoy: 10, mesesLluvia: [] });
  const b = simular(inicio(), REFERENCIAS, 12, 150);
  assert.deepEqual(a.meses.map((m) => m.flujo), b.meses.map((m) => m.flujo));
  assert.ok(a.meses.every((m) => m.seco === false));
});

test("totales: suman los meses pedidos y coinciden con el resumen por año", () => {
  const p = correr(entrada(), REFERENCIAS);
  const t12 = totales(p, 12);
  assert.equal(t12.meses, 12);
  assert.ok(Math.abs(t12.flujo - porAnio(p)[0].flujo) < 1e-3);
  assert.ok(Math.abs(totales(p).ingresos - (totales(p).ingresosCarne + totales(p).ingresosLeche)) < 1e-3);
  assert.ok(totales(p).picoAnimales >= totales(p).totalFinal);
});

test("sensibilidad: ordenada por impacto y con el signo que corresponde", () => {
  const s = { ...REFERENCIAS, hembras_ordenadas_pct: 100 };
  const f = sensibilidad(entrada(), s);
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1].impacto >= f[i].impacto);
  const de = (k) => f.find((x) => x.clave === k);
  assert.ok(de("precio_kg_vivo").siSube > 0 && de("precio_kg_vivo").siBaja < 0);
  assert.ok(de("costo_kg_ms").siSube < 0 && de("costo_kg_ms").siBaja > 0);
  assert.ok(de("mortalidad_levante_pct").siSube < 0);
  // un 10 % del precio mueve los ingresos de carne exactamente un 10 %
  const base = totales(correr(entrada(), s));
  assert.ok(Math.abs(de("precio_kg_vivo").siSube - base.ingresosCarne * 0.1) < 1e-3);
});

test("equilibrio: con ese precio lo que queda es cero y la holgura dice cuánto puede bajar", () => {
  const s = { ...REFERENCIAS, hembras_ordenadas_pct: 100 };
  for (const clave of ["precio_kg_vivo", "precio_litro"]) {
    const eq = equilibrio(entrada(), s, clave);
    assert.ok(eq.equilibrio !== null);
    const flujo = totales(correr(entrada(), { ...s, [clave]: eq.equilibrio })).flujo;
    assert.ok(Math.abs(flujo) < 1, `${clave}: ${flujo}`);
    assert.ok(Math.abs(eq.holguraPct - ((eq.actual - eq.equilibrio) / eq.actual) * 100) < 1e-9);
  }
  // en los primeros 12 meses el equilibrio es otro (los partos registrados tardan en pagar)
  assert.notEqual(equilibrio(entrada(), s, "precio_kg_vivo", 12).equilibrio, equilibrio(entrada(), s, "precio_kg_vivo", 24).equilibrio);
});

test("equilibrio: una línea que no vende nada no tiene precio de equilibrio", () => {
  const sinLeche = { ...REFERENCIAS, hembras_ordenadas_pct: 0 };
  assert.equal(equilibrio(entrada(), sinLeche, "precio_litro").equilibrio, null);
});

test("rango: pesimista < base < optimista y el camino base es la corrida normal", () => {
  const s = { ...REFERENCIAS, hembras_ordenadas_pct: 100 };
  const [pes, base, opt] = rango(entrada(), s);
  assert.ok(pes.totales.flujo < base.totales.flujo && base.totales.flujo < opt.totales.flujo);
  assert.equal(base.totales.flujo, totales(correr(entrada(), s)).flujo);
  assert.equal(base.flujoPorAnio.length, 2);
});

import ExcelJS from "exceljs";
import { ganadores, FILAS_COMPARACION } from "../lib/proyeccion/comparacion.ts";
import { limpiarNombre, nombreLibre, aEscenario } from "../lib/proyeccion/escenarios.ts";
import { construirLibroProyeccion } from "../lib/proyeccion/excel.ts";

test("comparación: marca al mejor de cada fila y a nadie si empatan o no hay qué comparar", () => {
  const flujo = FILAS_COMPARACION.find((f) => f.titulo === "Lo que queda en total");
  const costos = FILAS_COMPARACION.find((f) => f.titulo === "Costos");
  const animales = FILAS_COMPARACION.find((f) => f.titulo === "Animales vendidos");
  assert.deepEqual(ganadores(flujo, [10, 30, 20]), [false, true, false]);
  assert.deepEqual(ganadores(costos, [10, 30, 20]), [true, false, false]);
  assert.deepEqual(ganadores(flujo, [5, 5]), [false, false]);
  assert.deepEqual(ganadores(animales, [1, 9]), [false, false]);
  assert.deepEqual(ganadores(flujo, [7]), [false]);
});

test("escenarios: nombres limpios y sin repetirse; lo que llega de la base se limpia", () => {
  assert.equal(limpiarNombre("  Con   más  cabras "), "Con más cabras");
  assert.equal(limpiarNombre("   "), null);
  assert.equal(limpiarNombre("x".repeat(81)), null);
  assert.equal(limpiarNombre(5), null);
  assert.equal(nombreLibre("Base", ["base", "Otro"]), "Base 2");
  assert.equal(nombreLibre("Nuevo", ["Base"]), "Nuevo");
  assert.deepEqual(aEscenario({ id: "1", nombre: "A", horizonte_meses: 24, ajustes: { prolificidad: 1.6, basura: 3, peso_venta_kg: 999 } }), { id: "1", nombre: "A", horizonte: 24, ajustes: { prolificidad: 1.6 } });
});

test("Excel: hojas de resumen, mes a mes, supuestos, escenarios y riesgos con números de verdad", async () => {
  const b = armarBase(datos());
  const e = { inicio: b.inicio, horizonte: 24, gestacionDias: b.gestacionDias, estacion: { mesHoy: 10, mesesLluvia: [4, 5, 10, 11] } };
  const s = { ...b.base, hembras_ordenadas_pct: 100 };
  const proyeccion = correr(e, s);
  const buf = await construirLibroProyeccion({
    finca: "Finca de prueba", hoy: HOY, generado: new Date(), horizonte: 24, proyeccion, bloques: porAnio(proyeccion), supuestos: s, ajustes: { hembras_ordenadas_pct: 100 },
    procedencia: b.procedencia, base: b.base, entrada: e, escenarios: [{ id: "a", nombre: "Con más leche", horizonte: 24, ajustes: { hembras_ordenadas_pct: 100, litros_dia: 2 } }],
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumen por año", "Mes a mes", "Supuestos", "Escenarios", "Riesgos"]);
  const meses = wb.getWorksheet("Mes a mes");
  assert.equal(meses.rowCount, 6 + 24);
  assert.equal(typeof meses.getRow(7).getCell(2).value, "number");
  const esc = wb.getWorksheet("Escenarios");
  assert.equal(esc.getRow(6).getCell(2).value, "Lo que ves en pantalla");
  assert.equal(esc.getRow(6).getCell(3).value, "Con más leche");
  const filaFlujo = FILAS_COMPARACION.findIndex((f) => f.titulo === "Lo que queda en total");
  assert.ok(Math.abs(esc.getRow(7 + filaFlujo).getCell(2).value - totales(proyeccion).flujo) < 1);
  assert.ok(esc.getRow(7 + filaFlujo).getCell(3).value > esc.getRow(7 + filaFlujo).getCell(2).value, "más litros por hembra deja más");
  const rie = wb.getWorksheet("Riesgos");
  assert.ok(rie.rowCount > 10);
});

import { repartirMachos } from "../lib/proyeccion/motor.ts";
import { costosSinRestar } from "../lib/proyeccion/vista.ts";

test("machos sin uso: solo se cuentan como sementales los que hacen falta y el resto se vende en el primer mes", () => {
  assert.deepEqual(repartirMachos({ vientres: 65, sementales: 0, machosSinUso: 33 }, 25), { sementales: 3, paraVenta: 30 });
  assert.deepEqual(repartirMachos({ vientres: 65, sementales: 2, machosSinUso: 33 }, 25), { sementales: 3, paraVenta: 32 });
  assert.deepEqual(repartirMachos({ vientres: 65, sementales: 5, machosSinUso: 4 }, 25), { sementales: 5, paraVenta: 4 });
  assert.deepEqual(repartirMachos({ vientres: 10, sementales: 0, machosSinUso: 1 }, 25), { sementales: 1, paraVenta: 0 });
  assert.deepEqual(repartirMachos({ vientres: 65, sementales: 1 }, 25), { sementales: 1, paraVenta: 0 });
});

test("machos sin uso: el simulador los vende, el balance cierra y los costos bajan frente a mantenerlos como sementales", () => {
  const con = inicio({ vientres: 65, sementales: 0, machosSinUso: 33, cohortes: [] });
  const p = simular(con, REFERENCIAS, 24);
  assert.ok(descuadreBalance(p) < 1e-6);
  assert.equal(p.meses[0].sementales, 3);
  assert.ok(p.meses[0].ventasAnimales > 25, `se venden ${p.meses[0].ventasAnimales}`);
  const todosSementales = simular({ ...con, sementales: 33, machosSinUso: 0 }, REFERENCIAS, 24);
  assert.ok(totales(p).costos < totales(todosSementales).costos);
  assert.ok(totales(p).flujo > totales(todosSementales).flujo);
  // con 1 hembra por semental se mantienen todos
  assert.equal(simular(con, { ...REFERENCIAS, hembras_por_semental: 5 }, 12).meses[0].sementales, 13);
});

test("base: machos adultos sin uso no se cuentan como sementales, los reproductores marcados sí", () => {
  const animales = [];
  for (let i = 0; i < 65; i++) animales.push({ id: `h${i}`, sexo: "hembra", estado: "activo", fecha_nacimiento: null, uso_macho: null });
  for (let i = 0; i < 33; i++) animales.push({ id: `m${i}`, sexo: "macho", estado: "activo", fecha_nacimiento: null, uso_macho: i === 0 ? "reproductor" : null });
  const b = armarBase(datos({ animales }));
  assert.equal(b.hato.sementales, 1);
  assert.equal(b.hato.machosSinUso, 32);
  assert.equal(b.hato.total, 98);
  const p = simular(b.inicio, b.base, 24, b.gestacionDias);
  assert.ok(descuadreBalance(p) < 1e-6);
  assert.equal(p.meses[0].sementales, 3);
});

test("carne y leche avisan lo que no restan y el resultado completo", () => {
  const p = simular(inicio(), { ...REFERENCIAS, hembras_ordenadas_pct: 100 }, 12);
  const b = porAnio(p)[0];
  assert.equal(costosSinRestar(b, "todo"), null);
  const carne = costosSinRestar(b, "carne");
  const leche = costosSinRestar(b, "leche");
  assert.ok(Math.abs(carne.sinRestar - (b.costos - b.costoAlimentoCeba)) < 1e-6);
  assert.ok(Math.abs(leche.sinRestar - (b.costos - b.costoAlimentoLactancia)) < 1e-6);
  assert.equal(carne.resultadoCompleto, b.flujo);
  // la cuenta cierra: (ingresos − alimento de la línea) − lo que no resta = resultado completo, sumando las dos líneas
  const margenCarne = b.ingresosCarne - b.costoAlimentoCeba;
  const margenLeche = b.ingresosLeche - b.costoAlimentoLactancia;
  const compartidos = b.costos - b.costoAlimentoCeba - b.costoAlimentoLactancia;
  assert.ok(Math.abs(margenCarne + margenLeche - compartidos - b.flujo) < 1e-3);
});
