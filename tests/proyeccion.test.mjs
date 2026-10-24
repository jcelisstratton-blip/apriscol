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
