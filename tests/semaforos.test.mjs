import { sugerirDestinos } from "../lib/sugerencias-corral.ts";
import { hrefVenta } from "../lib/semaforos.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  areasSemaforo, armarSenal, contarSenales, senalCalidad, senalCorrales, senalDosis, senalFamacha, senalFrio, senalPartos, senalProduccion, senalAbortos, senalMortalidadCrias, senalVaciaSinServicio,
  senalAlimento, senalInventario, senalRetiro, senalSecado, senalesDiagnostico, senalPruebas, senalCuarentena, senalPezunas, senalVacunas, senalMantenimiento, senalesCeba, senalesDinero,
} from "../lib/semaforos.ts";

const HOY = "2026-10-27";
const dia = (n) => new Date(Date.UTC(2026, 9, 27 + n)).toISOString().slice(0, 10);
const etiqueta = (id) => `Animal ${id}`;
const hembra = (id, extra) => ({ animal_id: id, estado: "gestante", ultimo_servicio: null, fecha_prevista_parto: null, diagnostico: null, fecha_diagnostico: null, en_lactancia: false, ...extra });

test("semáforos: cada rol ve solo su área (el veterinario, reproducción y sanidad) y el contador ninguna", () => {
  assert.deepEqual(areasSemaforo("veterinario", "profesional"), ["reproduccion", "sanidad", "inventario"]);
  assert.deepEqual(areasSemaforo("ordenador", "profesional"), ["leche", "alimento"]);
  assert.deepEqual(areasSemaforo("propietario", "profesional"), ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"]);
  assert.deepEqual(areasSemaforo("administrador", "profesional"), ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"]);
  assert.deepEqual(areasSemaforo("contador", "profesional"), ["dinero"]);
  // El plan manda: sin carne ni contabilidad (plan Cría) no hay ceba ni dinero.
  assert.ok(!areasSemaforo("propietario", "cria").includes("ceba") && !areasSemaforo("propietario", "cria").includes("dinero"));
  assert.ok(!areasSemaforo("propietario", "cria").includes("inventario") && !areasSemaforo("ordenador", "cria").includes("alimento"), "el inventario empieza en el plan Intermedio");
});

test("semáforos: el inventario avisa lo agotado, descuadrado, bajo y por vencer; lo que está por contar no", () => {
  const base = { tipo: "vacuna", unidad: "ml", presentacion: "frasco", contenido_presentacion: 100, stock_minimo: 200, desde: "2026-10-01", vence_pronto: null, compras_sin_calcular: 0, aplicaciones_sin_dosis: 0 };
  const filas = [
    { ...base, producto_id: "a", nombre: "Agotado", stock: 0 },
    { ...base, producto_id: "b", nombre: "Descuadrado", stock: -20 },
    { ...base, producto_id: "c", nombre: "Bajo", stock: 150 },
    { ...base, producto_id: "d", nombre: "Bien", stock: 900 },
    { ...base, producto_id: "e", nombre: "Vencido", stock: 900, vence_pronto: "2026-10-20" },
    { ...base, producto_id: "f", nombre: "Por vencer", stock: 900, vence_pronto: "2026-11-10" },
    { ...base, producto_id: "g", nombre: "Sin contar", desde: null, stock: null },
  ];
  const s = senalInventario(filas, HOY);
  assert.equal(s.area, "inventario");
  assert.equal(s.nivel, "rojo");
  assert.deepEqual(s.items.filter((i) => i.nivel === "rojo").map((i) => i.etiqueta), ["Vencido", "Agotado", "Descuadrado"]);
  assert.deepEqual(s.items.filter((i) => i.nivel === "ambar").map((i) => i.etiqueta), ["Bajo", "Por vencer"]);
  assert.ok(!s.items.some((i) => i.etiqueta === "Sin contar" || i.etiqueta === "Bien"));
  assert.equal(senalInventario([filas[3]], HOY).nivel, "verde");
});

test("semáforos: armarSenal ordena (rojo primero, lo más urgente primero) y calcula nivel y resumen", () => {
  const base = { id: "x", area: "sanidad", titulo: "T", queHacer: "Haz algo.", queSignifica: "", regla: "" };
  const item = (clave, nivel, orden) => ({ clave, etiqueta: clave, detalle: "", nivel, href: "/", orden });
  const s = armarSenal(base, [item("a", "ambar", 1), item("b", "rojo", 5), item("c", "rojo", 2)]);
  assert.deepEqual(s.items.map((i) => i.clave), ["c", "b", "a"]);
  assert.equal(s.nivel, "rojo");
  assert.equal(s.resumen, "2 en rojo · 1 en ámbar");
  const vacia = armarSenal(base, []);
  assert.equal(vacia.nivel, "verde");
  assert.equal(vacia.resumen, "En orden");
  assert.equal(armarSenal(base, [item("a", "ambar", 1)]).nivel, "ambar");
  assert.deepEqual(contarSenales([s, vacia, armarSenal(base, [item("a", "ambar", 1)])]), { rojo: 1, ambar: 1, verde: 1 });
});

test("semáforos: partos — verde lejos, ámbar a 30 y 14 días, ámbar hasta 7 días pasada, rojo después", () => {
  const filas = [
    hembra("lejos", { fecha_prevista_parto: dia(45) }),
    hembra("en30", { fecha_prevista_parto: dia(25) }),
    hembra("en10", { fecha_prevista_parto: dia(10) }),
    hembra("hoy", { fecha_prevista_parto: dia(0) }),
    hembra("pasada3", { fecha_prevista_parto: dia(-3) }),
    hembra("atrasada", { fecha_prevista_parto: dia(-12) }),
    hembra("vacia", { estado: "vacia", fecha_prevista_parto: dia(5) }),
  ];
  const s = senalPartos(filas, HOY, { preparar: 30, vigilar: 14 }, etiqueta);
  const por = Object.fromEntries(s.items.map((i) => [i.clave, i]));
  assert.ok(!por["parto-lejos"] && !por["parto-vacia"]);
  assert.equal(por["parto-en30"].nivel, "ambar");
  assert.match(por["parto-en30"].detalle, /maternidad/);
  assert.match(por["parto-en10"].detalle, /a diario/);
  assert.equal(por["parto-hoy"].detalle, "Pare hoy");
  assert.equal(por["parto-pasada3"].nivel, "ambar");
  assert.equal(por["parto-atrasada"].nivel, "rojo");
  assert.equal(s.items[0].clave, "parto-atrasada", "lo atrasado va primero");
  assert.equal(s.nivel, "rojo");
});

test("semáforos: una servida sin confirmar avisa que su fecha es una estimación", () => {
  const s = senalPartos([hembra("s", { estado: "servida", fecha_prevista_parto: dia(9) })], HOY, { preparar: 30, vigilar: 14 }, etiqueta);
  assert.match(s.items[0].detalle, /estimada/);
});

test("semáforos: diagnóstico — ámbar dentro de la ventana, rojo si la pasó, nada si es pronto; dudosos aparte", () => {
  const ventana = { desde: 30, hasta: 60 };
  const servida = (id, hace, extra) => hembra(id, { estado: "servida", ultimo_servicio: dia(-hace), ...extra });
  const [confirmar, repetir] = senalesDiagnostico(
    [servida("pronto", 10), servida("toca", 40), servida("tarde", 75), servida("dudosoToca", 50, { diagnostico: "dudoso", fecha_diagnostico: dia(-15) }), servida("dudosoTarde", 50, { diagnostico: "dudoso", fecha_diagnostico: dia(-40) })],
    HOY, ventana, etiqueta,
  );
  assert.deepEqual(confirmar.items.map((i) => [i.clave, i.nivel]), [["diagnostico-tarde", "rojo"], ["diagnostico-toca", "ambar"]]);
  assert.deepEqual(repetir.items.map((i) => [i.clave, i.nivel]), [["repetir-dudosoTarde", "rojo"], ["repetir-dudosoToca", "ambar"]]);
});

test("semáforos: secado — ámbar a los días de la finca, rojo a 7 o menos; último tercio en ámbar", () => {
  const enLactancia = (id, falta) => hembra(id, { en_lactancia: true, ultimo_servicio: dia(-(150 - falta)), fecha_prevista_parto: dia(falta) });
  const s = senalSecado([enLactancia("a", 55), enLactancia("b", 5), hembra("c", { ultimo_servicio: dia(-110), fecha_prevista_parto: dia(40) }), enLactancia("lejos", 90)], HOY, 60, 100, etiqueta);
  const por = Object.fromEntries(s.items.map((i) => [i.clave, i.nivel]));
  assert.deepEqual(por, { "secar-b": "rojo", "secar-a": "ambar", "tercio-c": "ambar" });
});

test("semáforos: FAMACHA — 4 o 5 sin desparasitar en rojo, 3 en ámbar, tratados y bajos no cuentan", () => {
  const f = (id, puntaje, desp = null) => ({ animal_id: id, puntaje, ultima_fecha: dia(-5), desparasitado_en: desp });
  const s = senalFamacha([f("a", 5), f("b", 4), f("c", 3), f("d", 2), f("e", 4, dia(-2))], etiqueta);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["famacha-a", "rojo"], ["famacha-b", "rojo"], ["famacha-c", "ambar"]]);
});

test("semáforos: dosis y programas — vencida en rojo, hoy o en 7 días en ámbar, lejos no cuenta", () => {
  const d = (clave, fecha, tipo = "dosis") => ({ clave, titulo: clave, fecha, animales: 3, tipo, href: "/" });
  const s = senalDosis([d("vencida", dia(-2)), d("hoy", dia(0)), d("sem", dia(6)), d("lejos", dia(20)), d("prog", dia(-1), "programa")], HOY);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["vencida", "rojo"], ["prog", "rojo"], ["hoy", "ambar"], ["sem", "ambar"]]);
  // Cada caso dice cuántos días lleva vencido (0 = todavía no vence): sirve para separar lo vencido de lo pendiente.
  assert.deepEqual(s.items.map((i) => [i.clave, i.atrasoDias]), [["vencida", 2], ["prog", 1], ["hoy", 0], ["sem", 0]]);
});

test("semáforos: retiro — ámbar mientras dura; el que ya terminó no aparece", () => {
  const s = senalRetiro(
    [{ animal_id: "a", retiro_leche_hasta: dia(3), retiro_carne_hasta: null }, { animal_id: "b", retiro_leche_hasta: dia(-1), retiro_carne_hasta: dia(-1) }, { animal_id: "c", retiro_leche_hasta: null, retiro_carne_hasta: dia(10) }],
    HOY, etiqueta,
  );
  assert.deepEqual(s.items.map((i) => i.clave), ["retiro-a", "retiro-c"]);
  assert.ok(s.items.every((i) => i.nivel === "ambar"));
});

test("semáforos: cadena de frío — 4 a 6 °C bien, hasta 2 °C fuera en ámbar, más lejos en rojo", () => {
  const l = (id, t, fecha = dia(-1)) => ({ id, fecha, momento: "almacenada", temperatura_c: t });
  const s = senalFrio([l("ok", 5), l("tibia", 7.5), l("caliente", 9.1), l("fria", 3)], HOY);
  const por = Object.fromEntries(s.items.map((i) => [i.clave, i.nivel]));
  assert.deepEqual(por, { "frio-caliente": "rojo", "frio-tibia": "ambar", "frio-fria": "ambar" });
});

test("semáforos: calidad — residuos y células sobre el límite en rojo; sin análisis reciente queda en orden con su nota", () => {
  const limites = { rcs: 1000, grasaMin: 3, grasaMax: 5, proteinaMin: 2.8, proteinaMax: 4 };
  const a = { id: "x", fecha: dia(-5), rcs_miles_ml: 1200, grasa_pct: 2.5, proteina_pct: 3.3, crioscopia_c: -0.512, residuos_antibioticos: "positivo" };
  const s = senalCalidad(a, limites);
  const por = Object.fromEntries(s.items.map((i) => [i.etiqueta, i.nivel]));
  assert.deepEqual(por, { "Residuos de antibiótico": "rojo", "Células somáticas": "rojo", Crioscopia: "rojo", Grasa: "ambar" });
  const sana = senalCalidad({ ...a, rcs_miles_ml: 400, grasa_pct: 4, crioscopia_c: -0.54, residuos_antibioticos: "negativo" }, limites);
  assert.equal(sana.nivel, "verde");
  assert.equal(senalCalidad({ ...a, rcs_miles_ml: 900, residuos_antibioticos: null, grasa_pct: 4, crioscopia_c: -0.54 }, { ...limites, grasaMin: null }).items.find((i) => i.etiqueta === "Células somáticas").nivel, "ambar");
  const sinAnalisis = senalCalidad(null, limites);
  assert.equal(sinAnalisis.nivel, "verde");
  assert.match(sinAnalisis.nota, /60 días/);
});

test("semáforos: producción que baja — crítico en rojo, alerta en ámbar, normal no cuenta", () => {
  const t = (id, nivel) => ({ animal_id: id, litros_base: 2, litros_recientes: 1.2, dias_base: 14, dias_recientes: 3, variacion: -0.4, nivel });
  const s = senalProduccion([t("a", "critico"), t("b", "alerta"), t("c", "normal"), t("d", "sin_datos")], etiqueta);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["prod-a", "rojo"], ["prod-b", "ambar"]]);
});

test("semáforos: corrales — cupo pasado y potrero que debe salir en rojo", () => {
  const u = (id, extra) => ({ id, nombre: `Corral ${id}`, ocupantes: 30, hacinada: false, estado: "ocupado", dias_ocupacion: 8, dias_ocupacion_max: 5, dias_descanso: null, dias_descanso_min: 35, ...extra });
  const s = senalCorrales([u("a", { hacinada: true }), u("b", { estado: "debe_salir" })]);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["cupo-a", "rojo"], ["rotacion-b", "rojo"]]);
  assert.equal(senalCorrales([]).nivel, "verde");
  // Cada caso dice qué hacer: cuántos animales sacar o que el lote debe pasar a otro potrero.
  const lleno = senalCorrales([u("c", { hacinada: true, capacidad: 10, ocupantes: 13 })]).items[0];
  assert.match(lleno.detalle, /tiene 13 animales y le caben 10/);
  assert.equal(lleno.queHacer, "Pasa 3 animales a otra instalación.");
  assert.equal(senalCorrales([u("d", { hacinada: true, capacidad: 10, ocupantes: 11 })]).items[0].queHacer, "Pasa 1 animal a otra instalación.");
  assert.equal(s.items[1].queHacer, "Pasa el lote a otro potrero para que este descanse 35 días.");
});

test("semáforos: los plazos de partos salen de Ajustes (no son fijos)", () => {
  const filas = [hembra("a", { fecha_prevista_parto: dia(25) }), hembra("b", { fecha_prevista_parto: dia(8) })];
  const corto = senalPartos(filas, HOY, { preparar: 10, vigilar: 5 }, etiqueta);
  assert.deepEqual(corto.items.map((i) => i.clave), ["parto-b"], "con 10 días de aviso la de 25 días no entra");
  assert.match(corto.items[0].detalle, /maternidad/, "a 8 días está sobre el plazo de vigilar (5): prepara");
  const largo = senalPartos(filas, HOY, { preparar: 40, vigilar: 10 }, etiqueta);
  assert.equal(largo.items.length, 2);
  assert.match(largo.items.find((i) => i.clave === "parto-b").detalle, /a diario/);
});

test("semáforos: vacías sin servicio — ámbar a los 60 días del parto, rojo a los 120; en temporada de monta no cuentan", () => {
  const vacia = (id, hace, extra) => hembra(id, { estado: "vacia", ultimo_parto: dia(-hace), ...extra });
  const s = senalVaciaSinServicio(
    [vacia("reciente", 30), vacia("a", 70), vacia("b", 130), vacia("enMonta", 200, { empadronamiento_id: "emp" }), hembra("gest", { ultimo_parto: dia(-90) }), vacia("sinParto", 0, { ultimo_parto: null })],
    HOY, 60, 120, etiqueta,
  );
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["vacia-b", "rojo"], ["vacia-a", "ambar"]]);
});

test("semáforos: abortos — uno solo no enciende la señal (salvo infeccioso); dos en el mes, ámbar; tres, rojo", () => {
  const ab = (id, hace, causa = "desconocida") => ({ id, madre_id: `m${id}`, fecha: dia(-hace), causa_aborto: causa });
  assert.equal(senalAbortos([ab("1", 5)], HOY, etiqueta).nivel, "verde");
  const infec = senalAbortos([ab("1", 5, "infecciosa")], HOY, etiqueta);
  assert.equal(infec.nivel, "ambar");
  assert.match(infec.items[0].detalle, /aíslala/);
  assert.equal(senalAbortos([ab("1", 5), ab("2", 20)], HOY, etiqueta).nivel, "ambar");
  assert.equal(senalAbortos([ab("1", 5), ab("2", 20), ab("3", 28)], HOY, etiqueta).nivel, "rojo");
  assert.equal(senalAbortos([ab("1", 5), ab("2", 45)], HOY, etiqueta).nivel, "verde", "uno fuera de los 30 días no cuenta");
});

test("semáforos: mortalidad de crías — por porcentaje, y con pocas crías no se evalúa", () => {
  const muertes = (n) => Array.from({ length: n }, (_, i) => ({ clave: `m${i}`, animalId: i % 2 ? `a${i}` : null, fecha: dia(-3), texto: `Cría ${i}` }));
  assert.equal(senalMortalidadCrias(30, muertes(2), HOY).nivel, "verde");
  const ambar = senalMortalidadCrias(30, muertes(4), HOY);
  assert.equal(ambar.nivel, "ambar");
  assert.equal(ambar.items[0].etiqueta, "Mortalidad de 13 %");
  assert.equal(senalMortalidadCrias(30, muertes(8), HOY).nivel, "rojo");
  const pocas = senalMortalidadCrias(5, muertes(3), HOY);
  assert.equal(pocas.nivel, "verde");
  assert.match(pocas.nota, /pocas/);
});

test("semáforos: pruebas — solo cuenta la última de cada tipo; CAE positivo en rojo, CMT positivo viejo no cuenta", () => {
  const p = (animal_id, prueba, hace, resultado) => ({ animal_id, prueba, fecha: dia(-hace), resultado });
  const s = senalPruebas(
    [p("a", "cae", 100, "positivo"), p("b", "cae", 200, "positivo"), p("b", "cae", 10, "negativo"), p("c", "cmt", 100, "positivo"), p("d", "cmt", 20, "positivo"), p("e", "cae", 12, "sospechoso"), p("f", "brucelosis", 45, "sospechoso"), p("g", "cae", 40, "negativo")],
    HOY, etiqueta,
  );
  const por = Object.fromEntries(s.items.map((i) => [i.clave, i.nivel]));
  assert.deepEqual(por, { "prueba-a-cae": "rojo", "prueba-d-cmt": "ambar", "prueba-e-cae": "ambar", "prueba-f-brucelosis": "rojo" });
});

test("semáforos: cuarentena — sin cuarentena en rojo; en cuarentena sin cumplir el mínimo en ámbar; cumplida no cuenta", () => {
  const c = (animal_id, situacion, diasN) => ({ animal_id, situacion, dias: diasN, desde: dia(-diasN), finca_id: "f", ubicacion_id: null });
  const s = senalCuarentena([c("a", "falta_cuarentena", 15), c("b", "en_cuarentena", 7), c("c", "en_cuarentena", 25)], etiqueta);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["cuarentena-a", "rojo"], ["cuarentena-b", "ambar"]]);
});

test("semáforos: pezuñas — atrasado en ámbar, muy atrasado o sin registro en rojo, al día no cuenta", () => {
  const plazos = { podologiaDias: 180, pediluvioDias: 30 };
  const aldia = [{ animal_id: "a", ultima_fecha: dia(-10) }];
  assert.equal(senalPezunas(aldia, aldia, plazos, HOY).nivel, "verde");
  const algo = senalPezunas([], [{ animal_id: "a", ultima_fecha: dia(-40) }], plazos, HOY);
  assert.equal(algo.items[0].nivel, "ambar");
  const mucho = senalPezunas([{ animal_id: "a", ultima_fecha: dia(-250) }], [], plazos, HOY);
  assert.equal(mucho.items[0].nivel, "rojo");
  assert.equal(senalPezunas([{ animal_id: "a", ultima_fecha: null }], [], plazos, HOY).items[0].nivel, "rojo");
});

test("semáforos: vacunas — usa el plazo de Ajustes; sin plazo no se evalúa y lo dice", () => {
  const ev = [{ fecha: dia(-340), producto_nombre: "Vacuna contra la rabia" }, { fecha: dia(-100), producto_nombre: "Vacuna clostridial 7 vías" }];
  const s = senalVacunas(ev, 365, 180, HOY);
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["vacuna-rabia", "ambar"]], "rabia vence en 25 días; la clostridial está al día");
  assert.equal(senalVacunas(ev, 300, null, HOY).items[0].nivel, "rojo", "rabia vencida hace 40 días");
  const sinPlazo = senalVacunas(ev, null, null, HOY);
  assert.equal(sinPlazo.nivel, "verde");
  assert.match(sinPlazo.nota, /rabia/);
  assert.equal(senalVacunas([], 365, null, HOY).items[0].nivel, "rojo", "nunca registrada");
});

test("semáforos: mantenimiento de la sala — atrasada en rojo, próxima en ámbar", () => {
  const m = (tipo, proxima) => ({ id: tipo, finca_id: "f", tipo, equipo: "Sala", fecha: dia(-30), created_at: dia(-30), proxima_fecha: proxima });
  const s = senalMantenimiento([m("lavado_alcalino", dia(-2)), m("presion_vacio", dia(4)), m("revision", dia(40))], HOY);
  assert.deepEqual(s.items.map((i) => i.nivel), ["rojo", "ambar"]);
});

test("semáforos: ceba — pesaje atrasado y ganancia baja, con rojo al doble del plazo o a la mitad del mínimo", () => {
  const a = (animalId, ultima, gdp, limite = 30) => ({ animalId, ultimaFecha: ultima === null ? null : dia(-ultima), gdpRecienteG: gdp, limiteDias: limite });
  const [pesaje, ganancia] = senalesCeba([a("ok", 10, 200), a("tarde", 40, 200), a("muyTarde", 70, 200), a("nunca", null, null), a("lento", 5, 100), a("muyLento", 5, 50)], 150, HOY, etiqueta);
  assert.deepEqual(pesaje.items.map((i) => [i.clave, i.nivel]), [["pesaje-nunca", "rojo"], ["pesaje-muyTarde", "rojo"], ["pesaje-tarde", "ambar"]]);
  assert.deepEqual(ganancia.items.map((i) => [i.clave, i.nivel]), [["gdp-muyLento", "rojo"], ["gdp-lento", "ambar"]]);
});

test("semáforos: dinero — vencido en rojo, en los próximos 7 días en ámbar, lejos no cuenta", () => {
  const compra = (id, vence) => ({ id, descripcion: `Compra ${id}`, monto: 100000, vence });
  const venta = (clave, vence) => ({ clave, producto: "Queso", tercero: null, valor: 50000, cobro_vence: vence });
  const [pagar, cobrar] = senalesDinero([compra("a", dia(-3)), compra("b", dia(5)), compra("c", dia(20))], [venta("x", dia(-1)), venta("y", dia(30))], HOY);
  assert.deepEqual(pagar.items.map((i) => [i.clave, i.nivel]), [["pagar-a", "rojo"], ["pagar-b", "ambar"]]);
  assert.match(pagar.items[0].detalle, /venció hace 3 días/);
  assert.deepEqual(cobrar.items.map((i) => [i.clave, i.nivel]), [["cobrar-x", "rojo"]]);
});

import { senalCoprologico } from "../lib/semaforos.ts";
test("semáforo coprológico: solo cargas altas sin desparasitar; rojo desde 3.000", () => {
  const etiqueta = (id) => id;
  const s = senalCoprologico(
    [
      { animal_id: "bajo", hpg: 400, ultima_fecha: "2026-10-01", desparasitado_en: null },
      { animal_id: "alto", hpg: 1500, ultima_fecha: "2026-10-01", desparasitado_en: null },
      { animal_id: "muy", hpg: 5000, ultima_fecha: "2026-10-01", desparasitado_en: null },
      { animal_id: "tratado", hpg: 5000, ultima_fecha: "2026-10-01", desparasitado_en: "2026-10-05" },
      { animal_id: "solo_ooquistes", hpg: null, ultima_fecha: "2026-10-01", desparasitado_en: null },
    ],
    etiqueta,
  );
  assert.deepEqual(s.items.map((i) => [i.clave, i.nivel]), [["coprologico-muy", "rojo"], ["coprologico-alto", "ambar"]]);
  assert.ok(s.items[0].queHacer);
});

test("semáforos: el alimento avisa lo agotado, descuadrado y lo que alcanza para pocos días; sin datos o por contar no", () => {
  const base = { rubro: "concentrado", unidad: "bultos", kg_por_unidad: 40, desde: "2026-10-01", compras_sin_calcular: 0, consumo_kg: 140, dias_con_salida: 14 };
  const filas = [
    { ...base, producto_id: "a", nombre: "Agotado", stock_kg: 0 },
    { ...base, producto_id: "b", nombre: "Descuadrado", stock_kg: -10 },
    { ...base, producto_id: "c", nombre: "Crítico", stock_kg: 30 },
    { ...base, producto_id: "d", nombre: "Bajo", stock_kg: 60 },
    { ...base, producto_id: "e", nombre: "Bien", stock_kg: 400 },
    { ...base, producto_id: "f", nombre: "Sin datos", stock_kg: 5, dias_con_salida: 1 },
    { ...base, producto_id: "g", nombre: "Sin contar", desde: null, stock_kg: null },
  ];
  const s = senalAlimento(filas, 7, HOY);
  assert.equal(s.area, "alimento");
  assert.equal(s.nivel, "rojo");
  assert.deepEqual(s.items.filter((i) => i.nivel === "rojo").map((i) => i.etiqueta), ["Agotado", "Descuadrado", "Crítico"]);
  assert.deepEqual(s.items.filter((i) => i.nivel === "ambar").map((i) => i.etiqueta), ["Bajo"]);
  assert.equal(senalAlimento([filas[4]], 7, HOY).nivel, "verde");
});

test("sugerencias de corral: solo destinos con cupo, del mismo tipo, sin fin especial y con capacidad definida", () => {
  const ub = (id, extra = {}) => ({ id, nombre: `Corral ${id}`, tipo: "corral", uso: "general", activa: true, capacidad: 10, ocupantes: 4, hacinada: false, estado: "ocupado", dias_descanso: null, ...extra });
  const origen = ub("o", { capacidad: 10, ocupantes: 13, hacinada: true });
  const todas = [
    origen,
    ub("a", { ocupantes: 4 }), // caben 6
    ub("b", { ocupantes: 9 }), // caben 1: no alcanza para 3
    ub("c", { uso: "cuarentena", ocupantes: 0 }), // fin especial
    ub("d", { capacidad: null }), // sin capacidad definida: no se sabe si cabe
    ub("e", { activa: false, ocupantes: 0 }), // archivado
    ub("f", { hacinada: true, ocupantes: 11 }), // ya pasó su cupo
    ub("g", { tipo: "potrero", estado: "listo", dias_descanso: 40, ocupantes: 0 }), // otro tipo
    ub("h", { ocupantes: 2, uso: "general" }), // caben 8: más espacio que «a»
  ];
  assert.deepEqual(sugerirDestinos(origen, 3, todas).map((d) => d.id), ["h", "a"]);
  assert.equal(sugerirDestinos(origen, 3, todas)[0].motivo, "caben 8 más (2 de 10)");
  assert.deepEqual(sugerirDestinos(origen, 7, todas).map((d) => d.id), ["h"], "para 7 solo cabe en la que tiene 8 libres");
  assert.deepEqual(sugerirDestinos(origen, 20, todas), []);
  assert.deepEqual(sugerirDestinos(origen, 0, todas), []);
  assert.equal(sugerirDestinos(origen, 3, todas, 1).length, 1);
  // Un potrero solo se sugiere si ya descansó (o nunca se usó); uno ocupado, en descanso o que debe salir no.
  const pot = (id, extra) => ub(id, { tipo: "potrero", ocupantes: 0, ...extra });
  const potreros = [pot("p1", { estado: "listo", dias_descanso: 45 }), pot("p2", { estado: "descanso", dias_descanso: 10 }), pot("p3", { estado: "debe_salir", ocupantes: 5 }), pot("p4", { estado: "vacio" }), pot("p5", { estado: "ocupado", ocupantes: 3 })];
  const desde = pot("x", { estado: "debe_salir", ocupantes: 6 });
  assert.deepEqual(sugerirDestinos(desde, 6, [desde, ...potreros]).map((d) => [d.id, d.motivo]), [["p1", "descansó 45 días, caben 10 más (0 de 10)"], ["p4", "sin uso todavía, caben 10 más (0 de 10)"]]);
  // Las del mismo uso van primero.
  const conUso = [ub("m1", { uso: "ceba", ocupantes: 0 }), ub("m2", { uso: "general", ocupantes: 5 })];
  assert.deepEqual(sugerirDestinos(ub("z", { uso: "general", hacinada: true, ocupantes: 12 }), 2, conUso).map((d) => d.id), ["m2", "m1"]);
});

test("semáforos: corrales — el qué hacer incluye una sugerencia de a dónde cuando hay espacio", () => {
  const ub = (id, extra = {}) => ({ id, nombre: `Corral ${id}`, tipo: "corral", uso: "general", activa: true, capacidad: 10, ocupantes: 4, hacinada: false, estado: "ocupado", dias_ocupacion: 8, dias_ocupacion_max: 5, dias_descanso: null, dias_descanso_min: 35, ...extra });
  const lleno = ub("c", { hacinada: true, capacidad: 10, ocupantes: 13 });
  const con = senalCorrales([lleno, ub("a", { ocupantes: 4 })]).items[0];
  assert.equal(con.queHacer, "Pasa 3 animales a otra instalación. Sugerencia: Corral a (caben 6 más (4 de 10)).");
  const sin = senalCorrales([lleno, ub("b", { ocupantes: 9 })]).items[0];
  assert.equal(sin.queHacer, "Pasa 3 animales a otra instalación.", "si ninguna tiene espacio no se inventa una sugerencia");
});

test("semáforos: toda señal dice qué hacer (armarSenal lo exige) y nada queda con textos vacíos o sin completar", () => {
  const base = { id: "x", area: "sanidad", titulo: "T", queSignifica: "a", regla: "b" };
  assert.throws(() => armarSenal({ ...base, queHacer: "" }, []), /no dice qué hacer/);
  assert.throws(() => armarSenal({ ...base, queHacer: "   " }, []), /no dice qué hacer/);
  assert.equal(armarSenal({ ...base, queHacer: "Haz algo." }, []).queHacer, "Haz algo.");
});

test("semáforos: dinero — cada cobro y cada pago llevan a SU registro, no a la lista general", () => {
  const ID = "5e1f0a11-0000-4000-8000-0000000000aa";
  // Según de dónde viene la venta: una venta registrada, un despacho de leche o la baja de un animal.
  assert.equal(hrefVenta("venta", ID), `/hato/ventas/${ID}/editar`);
  assert.equal(hrefVenta("leche", ID), `/leche/despachos/${ID}`);
  assert.equal(hrefVenta("animal", ID), `/hato/${ID}#salida`);
  assert.equal(hrefVenta("otra-cosa", ID), "/hato?vista=ventas");

  const compra = { id: ID, descripcion: "Concentrado", monto: 100000, vence: dia(-2) };
  const ventaLeche = { clave: `leche-${ID}`, origen: "leche", origen_id: ID, producto: "Leche", tercero: "Lácteos del Norte", valor: 800000, cobro_vence: dia(-5) };
  const ventaSinComprador = { clave: `venta-${ID}`, origen: "venta", origen_id: ID, producto: "Queso", tercero: null, valor: 50000, cobro_vence: dia(-1) };
  const [pagar, cobrar] = senalesDinero([compra], [ventaLeche, ventaSinComprador], HOY);
  assert.equal(pagar.items[0].href, `/hato/gastos/${ID}/editar`);
  assert.equal(pagar.items[0].queHacer, "Paga y marca la compra como pagada.");
  const leche = cobrar.items.find((i) => i.etiqueta.startsWith("Leche"));
  assert.equal(leche.href, `/leche/despachos/${ID}`);
  assert.equal(leche.queHacer, "Cobra a Lácteos del Norte y registra el cobro en la venta.");
  const queso = cobrar.items.find((i) => i.etiqueta.startsWith("Queso"));
  assert.equal(queso.href, `/hato/ventas/${ID}/editar`);
  assert.equal(queso.queHacer, "Cobra y registra el cobro en la venta.");
});
