// Esquila de ovejas: cobertura (lana / pelo / por definir) y plazos.
import test from "node:test";
import assert from "node:assert/strict";
import { coberturaEfectiva, seEsquila, plazoEsquila, sumarMeses, kilosVellon, textoPlazo, ESQUILA_CADA_MESES } from "../lib/esquila.ts";

test("cobertura: la propia manda sobre la de la raza; las cabras no tienen", () => {
  assert.equal(coberturaEfectiva("ovino", null, "lana"), "lana");
  assert.equal(coberturaEfectiva("ovino", null, "pelo"), "pelo");
  assert.equal(coberturaEfectiva("ovino", "lana", "pelo"), "lana", "una Pelibuey que la persona marca de lana");
  assert.equal(coberturaEfectiva("ovino", "pelo", "lana"), "pelo", "una Merino que la persona marca de pelo");
  assert.equal(coberturaEfectiva("caprino", null, null), null);
  assert.equal(coberturaEfectiva("caprino", "lana", "lana"), null, "una cabra nunca se esquila, aunque traiga el dato");
});

test("cobertura: las criollas, los cruces y las ovejas sin raza quedan «por definir» hasta que la persona decida", () => {
  assert.equal(coberturaEfectiva("ovino", null, "variable"), "por_definir");
  assert.equal(coberturaEfectiva("ovino", null, null), "por_definir");
  assert.equal(coberturaEfectiva("ovino", undefined, undefined), "por_definir");
  assert.equal(coberturaEfectiva("ovino", "lana", "variable"), "lana");
  assert.equal(coberturaEfectiva("ovino", "pelo", "variable"), "pelo");
});

test("solo se esquilan las de lana: las de pelo, las por definir y las cabras no", () => {
  assert.equal(seEsquila("lana"), true);
  for (const c of ["pelo", "por_definir", null]) assert.equal(seEsquila(c), false, String(c));
});

test("sumarMeses: no se pasa del fin de mes ni se equivoca de año", () => {
  assert.equal(sumarMeses("2026-03-15", 12), "2027-03-15");
  assert.equal(sumarMeses("2026-08-31", 6), "2027-02-28");
  assert.equal(sumarMeses("2027-08-31", 6), "2028-02-29", "año bisiesto");
  assert.equal(sumarMeses("2026-11-30", 3), "2027-02-28");
  assert.equal(sumarMeses("2026-12-10", 1), "2027-01-10");
  assert.equal(sumarMeses("2026-01-31", 0), "2026-01-31");
});

test("plazo: sin esquila registrada no se inventa fecha; al día, toca y atrasada según la fecha prevista", () => {
  assert.deepEqual(plazoEsquila(null, "2026-11-18"), { estado: "sin_esquila", proxima: null, dias: null });
  assert.equal(ESQUILA_CADA_MESES, 12);
  // última esquila 2026-03-01 → próxima 2027-03-01
  assert.deepEqual(plazoEsquila("2026-03-01", "2026-11-18"), { estado: "al_dia", proxima: "2027-03-01", dias: 103 });
  assert.equal(plazoEsquila("2026-03-01", "2027-01-30").estado, "toca"); // faltan 30 días: justo en el borde del aviso
  assert.equal(plazoEsquila("2026-03-01", "2027-01-29").estado, "al_dia"); // 31 días
  assert.equal(plazoEsquila("2026-03-01", "2027-03-01").estado, "toca"); // hoy mismo
  assert.equal(plazoEsquila("2026-03-01", "2027-03-01").dias, 0);
  assert.equal(plazoEsquila("2026-03-01", "2027-03-02").estado, "atrasada");
  // un plazo propio (seis meses) y un aviso propio
  assert.equal(plazoEsquila("2026-03-01", "2026-09-10", 6, 10).estado, "atrasada");
  assert.equal(plazoEsquila("2026-03-01", "2026-08-25", 6, 10).estado, "toca");
});

test("textos: llanos y con el singular bien puesto", () => {
  assert.equal(textoPlazo({ estado: "sin_esquila", proxima: null, dias: null }), "Sin esquila registrada");
  assert.equal(textoPlazo({ estado: "atrasada", proxima: "2026-01-01", dias: -1 }), "Atrasada 1 día");
  assert.equal(textoPlazo({ estado: "atrasada", proxima: "2026-01-01", dias: -40 }), "Atrasada 40 días");
  assert.equal(textoPlazo({ estado: "toca", proxima: "2026-01-01", dias: 0 }), "Le toca hoy");
  assert.equal(textoPlazo({ estado: "toca", proxima: "2026-01-01", dias: 1 }), "Le toca en 1 día");
  assert.equal(textoPlazo({ estado: "al_dia", proxima: "2026-01-01", dias: 90 }), "Próxima en 90 días");
  assert.equal(kilosVellon(2.4), "2,4 kg");
  assert.equal(kilosVellon(3), "3 kg");
  assert.equal(kilosVellon(null), "—");
});

import { resumirEsquila, ordenarPorUrgencia } from "../lib/esquila.ts";
import { visibilidadMenu, menuPrincipal } from "../lib/menu.ts";
import { atajosPara } from "../lib/atajos.ts";

test("resumen: cuenta lana, pelo y por definir, y de las de lana cuántas están atrasadas, les toca o nunca se han esquilado", () => {
  const p = (estado, dias) => ({ estado, proxima: null, dias });
  const r = resumirEsquila([
    { cobertura: "lana", plazo: p("atrasada", -10) },
    { cobertura: "lana", plazo: p("toca", 5) },
    { cobertura: "lana", plazo: p("sin_esquila", null) },
    { cobertura: "lana", plazo: p("al_dia", 200) },
    { cobertura: "pelo", plazo: null },
    { cobertura: "pelo", plazo: null },
    { cobertura: "por_definir", plazo: null },
  ]);
  assert.deepEqual(r, { total: 7, lana: 4, pelo: 2, porDefinir: 1, atrasadas: 1, tocan: 1, sinEsquila: 1, alDia: 1 });
  assert.equal(resumirEsquila([]).total, 0);
});

test("orden: primero la más atrasada, luego a la que le toca antes, luego las que nunca se han esquilado y al final las que están al día", () => {
  const p = (estado, dias) => ({ estado, proxima: null, dias });
  const orden = ordenarPorUrgencia([
    { n: "dia", plazo: p("al_dia", 300) },
    { n: "sin", plazo: p("sin_esquila", null) },
    { n: "toca20", plazo: p("toca", 20) },
    { n: "atr5", plazo: p("atrasada", -5) },
    { n: "toca3", plazo: p("toca", 3) },
    { n: "atr40", plazo: p("atrasada", -40) },
  ]).map((x) => x.n);
  assert.deepEqual(orden, ["atr40", "atr5", "toca3", "toca20", "sin", "dia"]);
});

test("menú y «Al grano»: la esquila solo aparece si la finca tiene ovejas (y el rol puede ver el hato)", () => {
  const entradas = (v) => menuPrincipal(v).flatMap((g) => g.entradas.map((e) => e.etiqueta));
  assert.ok(!entradas(visibilidadMenu("propietario", "cria", ["caprino"])).includes("Esquila"), "solo cabras: no se ve");
  assert.ok(!entradas(visibilidadMenu("propietario", "cria")).includes("Esquila"), "sin saber las especies: no se ve");
  for (const especies of [["ovino"], ["caprino", "ovino"]]) assert.ok(entradas(visibilidadMenu("propietario", "cria", especies)).includes("Esquila"), especies.join());
  // En «Producción y manejo», justo antes de Corrales.
  const grupo = menuPrincipal(visibilidadMenu("propietario", "hato", ["ovino"])).find((g) => g.titulo === "Producción y manejo").entradas.map((e) => e.etiqueta);
  assert.ok(grupo.indexOf("Esquila") < grupo.indexOf("Corrales"));
  // «Al grano»: los dos atajos salen solo con ovejas.
  const rutas = (especies) => atajosPara("propietario", "cria", especies).map((a) => a.href);
  assert.ok(!rutas(["caprino"]).includes("/esquila") && !rutas(["caprino"]).includes("/esquila/nueva"));
  assert.ok(rutas(["ovino"]).includes("/esquila") && rutas(["ovino"]).includes("/esquila/nueva"));
});

import { GRUPOS_AJUSTES } from "../lib/ajustes.ts";
import { RUTA_AREA } from "../lib/notificaciones/mensajes.ts";
import { ayudaEsquila } from "../lib/ayuda.ts";

test("ajustes: el plazo de la esquila es un grupo propio, solo para fincas con ovejas, con su rango", () => {
  const g = GRUPOS_AJUSTES.find((x) => x.id === "esquila");
  assert.ok(g, "falta el grupo «Esquila» en Ajustes");
  assert.equal(g.soloConEspecie, "ovino");
  const campos = Object.fromEntries(g.general.map((c) => [c.clave, c]));
  assert.deepEqual([campos.esquila_cada_meses.min, campos.esquila_cada_meses.max], [3, 24]);
  assert.deepEqual([campos.esquila_aviso_dias.min, campos.esquila_aviso_dias.max], [7, 90]);
  // Los demás grupos se ven siempre.
  assert.ok(GRUPOS_AJUSTES.filter((x) => x.id !== "esquila").every((x) => !x.soloConEspecie));
});

test("Telegram y semáforos: el área de esquila lleva a /esquila; la ayuda usa los plazos de la finca", () => {
  assert.equal(RUTA_AREA.esquila, "/esquila");
  const h = JSON.stringify(ayudaEsquila({ esquila_cada_meses: 8, esquila_aviso_dias: 20 }));
  assert.match(h, /cada 8 meses/);
  assert.match(h, /20 días antes/);
});
