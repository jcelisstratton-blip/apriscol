// Cobranza del superadmin: filtros, número de WhatsApp y mensaje de cobro (reglas puras).
import test from "node:test";
import assert from "node:assert/strict";
import { coincideFiltro, mensajeCobranza, telefonoWhatsApp } from "../lib/cobranza.ts";

const base = {
  finca_id: "f", nombre: "La Esperanza", propietario_email: "a@b.co", propietario_nombre: "Ana María Pérez", telefono: "300 123 4567",
  plan: "hato", plan_vence_en: "2026-11-21", estado: "por_vencer", dias_restantes: 5, numero_finca: 1, cuenta_pruebas: false, ultimo_pago_en: null,
};
const nequi = { numero: "300 111 2222", titular: "Titular Prueba" };

test("filtros: «por cobrar» es todo lo que no está al día", () => {
  for (const e of ["pendiente", "por_vencer", "gracia", "bloqueada"]) assert.equal(coincideFiltro({ estado: e }, "por_cobrar"), true);
  assert.equal(coincideFiltro({ estado: "vigente" }, "por_cobrar"), false);
  assert.equal(coincideFiltro({ estado: "vigente" }, "todas"), true);
  assert.equal(coincideFiltro({ estado: "gracia" }, "gracia"), true);
  assert.equal(coincideFiltro({ estado: "gracia" }, "bloqueada"), false);
});

test("WhatsApp: acepta formatos colombianos y rechaza lo que no es celular", () => {
  assert.equal(telefonoWhatsApp("300 123 4567"), "573001234567");
  assert.equal(telefonoWhatsApp("3001234567"), "573001234567");
  assert.equal(telefonoWhatsApp("+57 300 123 4567"), "573001234567");
  assert.equal(telefonoWhatsApp("573001234567"), "573001234567");
  assert.equal(telefonoWhatsApp("604 123 4567"), null); // fijo
  assert.equal(telefonoWhatsApp(""), null);
  assert.equal(telefonoWhatsApp("abc"), null);
});

test("mensaje: al día no se cobra; por vencer lleva fecha, precio y Nequi", () => {
  assert.equal(mensajeCobranza({ ...base, estado: "vigente" }, nequi), null);
  const m = mensajeCobranza(base, nequi);
  assert.match(m, /Hola Ana,/);
  assert.match(m, /vence el 21 de noviembre de 2026/);
  assert.match(m, /US\$ 18 al mes/); // Hato, primera finca
  assert.match(m, /300 111 2222/);
  assert.match(m, /La Esperanza/);
});

test("mensaje: la finca adicional lleva su 10 % menos y la gracia dice hasta cuándo se consulta", () => {
  const m = mensajeCobranza({ ...base, plan: "cria", numero_finca: 2, estado: "gracia", plan_vence_en: "2026-10-20" }, null);
  assert.match(m, /US\$ 9 al mes/);
  assert.match(m, /hasta el 27 de octubre de 2026/i);
  assert.match(m, /datos de pago por Nequi/); // sin Nequi configurado
});

test("mensaje: pendiente y bloqueada", () => {
  const p = mensajeCobranza({ ...base, estado: "pendiente", plan: "cria", plan_vence_en: null, numero_finca: 2 }, nequi);
  assert.match(p, /ya está creada y se activa/);
  const b = mensajeCobranza({ ...base, estado: "bloqueada", plan_vence_en: "2026-09-01" }, nequi);
  assert.match(b, /bloqueada/);
  assert.match(b, /puedes descargarlos/);
});
