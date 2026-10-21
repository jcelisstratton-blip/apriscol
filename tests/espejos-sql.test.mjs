// Reglas que la app repite en TypeScript y la base aplica en SQL: las dos tienen que decir lo mismo.
// Los valores de la base están en fixtures/espejos-sql.json (se generan con fixtures/generar-espejos.sql).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoPlan } from "../lib/vigencia.ts";
import { moduloEnPlan, PLANES } from "../lib/planes.ts";
import { grupoDe } from "../lib/costos.ts";
import { nivelEndogamia } from "../lib/endogamia.ts";
import { sumarDias } from "../lib/fechas.ts";

const base = JSON.parse(readFileSync(new URL("./fixtures/espejos-sql.json", import.meta.url), "utf8"));

test("vigencia: estadoPlan == private.estado_plan, día por día", () => {
  const hoy = "2030-06-15";
  for (const { dias, estado } of base.estado_plan) {
    assert.equal(estadoPlan(sumarDias(hoy, dias), hoy), estado, `vence a ${dias} días de hoy`);
  }
  assert.equal(estadoPlan(null, hoy), "vigente");
});

test("planes: moduloEnPlan == private.modulo_rango para cada módulo y plan", () => {
  for (const [modulo, rango] of Object.entries(base.modulo_rango)) {
    PLANES.forEach((p, i) => assert.equal(moduloEnPlan(p.id, modulo), i + 1 >= rango, `${modulo} en ${p.id}`));
  }
});

test("costos: grupoDe == private.grupo_rubro para cada rubro", () => {
  for (const [rubro, grupo] of Object.entries(base.grupo_rubro)) assert.equal(grupoDe(rubro), grupo, rubro);
});

test("endogamia: «alto» o más == private.sobre_umbral, incluidos los bordes del decimal", () => {
  for (const { f, umbral, sobre } of base.sobre_umbral) {
    const n = nivelEndogamia(f, umbral);
    assert.equal(n === "alto" || n === "muy_alto", sobre, `f=${f} umbral=${umbral} → ${n}`);
  }
  // El ruido del decimal binario no cambia el nivel (0,1 + 0,2 es 0,30000000000000004).
  assert.equal(nivelEndogamia(0.1 + 0.2, 0.3), nivelEndogamia(0.3, 0.3));
});
