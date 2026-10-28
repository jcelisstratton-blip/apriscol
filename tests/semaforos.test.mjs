import test from "node:test";
import assert from "node:assert/strict";
import {
  areasSemaforo, armarSenal, contarSenales, senalCalidad, senalCorrales, senalDosis, senalFamacha, senalFrio, senalPartos, senalProduccion, senalAbortos, senalMortalidadCrias, senalVaciaSinServicio,
  senalRetiro, senalSecado, senalesDiagnostico,
} from "../lib/semaforos.ts";

const HOY = "2026-10-27";
const dia = (n) => new Date(Date.UTC(2026, 9, 27 + n)).toISOString().slice(0, 10);
const etiqueta = (id) => `Animal ${id}`;
const hembra = (id, extra) => ({ animal_id: id, estado: "gestante", ultimo_servicio: null, fecha_prevista_parto: null, diagnostico: null, fecha_diagnostico: null, en_lactancia: false, ...extra });

test("semáforos: cada rol ve solo su área (el veterinario, reproducción y sanidad) y el contador ninguna", () => {
  assert.deepEqual(areasSemaforo("veterinario", "profesional"), ["reproduccion", "sanidad"]);
  assert.deepEqual(areasSemaforo("ordenador", "profesional"), ["leche"]);
  assert.deepEqual(areasSemaforo("propietario", "profesional"), ["reproduccion", "sanidad", "leche", "corrales"]);
  assert.deepEqual(areasSemaforo("administrador", "profesional"), ["reproduccion", "sanidad", "leche", "corrales"]);
  assert.deepEqual(areasSemaforo("contador", "profesional"), []);
});

test("semáforos: armarSenal ordena (rojo primero, lo más urgente primero) y calcula nivel y resumen", () => {
  const base = { id: "x", area: "sanidad", titulo: "T", queSignifica: "", regla: "" };
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
