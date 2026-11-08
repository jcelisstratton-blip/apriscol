import test from "node:test";
import assert from "node:assert/strict";
import { MONEDAS, MONEDA_DEFECTO, cifraDinero, dinero, esMonedaValida, formatoExcelDinero, monedaDe } from "../lib/moneda.ts";
import { formatear } from "../lib/proyeccion/vista.ts";
import { textoCelda } from "../lib/reportes/formato.ts";
import { senalesDinero } from "../lib/semaforos.ts";

const sinEspeciales = (t) => t.replace(/[  ]/g, " ");

test("la moneda de fábrica es el peso colombiano y se escribe como siempre", () => {
  assert.equal(MONEDA_DEFECTO, "COP");
  assert.equal(sinEspeciales(dinero(1250000)), "$ 1.250.000");
  assert.equal(sinEspeciales(dinero(1250000, "COP")), "$ 1.250.000");
  assert.equal(sinEspeciales(dinero(0)), "$ 0");
  assert.equal(dinero(null, "COP", "—"), "—");
  assert.equal(sinEspeciales(dinero(null)), "$ 0");
});

test("cada moneda de la lista es válida para Intl y tiene lo necesario", () => {
  const codigos = new Set();
  for (const m of MONEDAS) {
    assert.match(m.codigo, /^[A-Z]{3}$/, m.codigo); // lo mismo que exige la base (fincas_moneda_check)
    assert.ok(!codigos.has(m.codigo), `repetida ${m.codigo}`);
    codigos.add(m.codigo);
    assert.ok(m.nombre && m.simbolo && m.paises, m.codigo);
    assert.ok(esMonedaValida(m.codigo));
    const t = sinEspeciales(dinero(1234.5, m.codigo));
    assert.ok(/\d/.test(t), `${m.codigo}: ${t}`);
  }
  assert.ok(MONEDAS.some((m) => m.codigo === "COP"));
});

test("una moneda desconocida cae en pesos colombianos y no rompe ninguna pantalla", () => {
  assert.equal(monedaDe("XXX").codigo, "COP");
  assert.equal(monedaDe(null).codigo, "COP");
  assert.equal(esMonedaValida("XXX"), false);
  assert.equal(sinEspeciales(dinero(1000, "XXX")), "$ 1.000");
});

test("los decimales dependen de la moneda: el peso colombiano no lleva centavos y el sol, sí", () => {
  assert.equal(sinEspeciales(dinero(1250.5, "COP")), "$ 1.251");
  assert.match(sinEspeciales(dinero(1250.5, "PEN")), /S\/\s?1\.250,50|PEN\s?1\.250,50|S\/\s?1,250\.50/);
  assert.match(sinEspeciales(dinero(1250.5, "EUR")), /1\.250,50\s?€|1250,50\s?€/);
  assert.equal(cifraDinero(1250000, "COP").replace(/ /g, " "), "1.250.000");
});

test("el formato de Excel lleva el símbolo de la moneda y los negativos en rojo", () => {
  assert.equal(formatoExcelDinero("COP"), '"$" #,##0;[Red]-"$" #,##0');
  assert.equal(formatoExcelDinero("PEN"), '"S/" #,##0.00;[Red]-"S/" #,##0.00');
  assert.equal(formatoExcelDinero(), formatoExcelDinero("COP"));
});

test("las pantallas que escriben dinero respetan la moneda de la finca", () => {
  assert.equal(sinEspeciales(formatear("pesos", 1500000)), "$ 1.500.000");
  assert.match(sinEspeciales(formatear("pesos", -2500, "PEN")), /^−S\/\s?2\.500,00|^−S\/\s?2,500\.00/);
  assert.equal(sinEspeciales(textoCelda({ tipo: "pesos" }, 1500000)), "$ 1.500.000");
  assert.match(sinEspeciales(textoCelda({ tipo: "pesos" }, 1500000, "MXN")), /\$\s?1\.500\.000,00|\$\s?1,500,000\.00/);
  const [pagar] = senalesDinero([{ id: "1", descripcion: "Concentrado", monto: 120000, vence: "2026-11-01" }], [], "2026-11-08", "USD");
  assert.match(sinEspeciales(pagar.items[0].detalle), /\$\s?120\.000,00/);
});
