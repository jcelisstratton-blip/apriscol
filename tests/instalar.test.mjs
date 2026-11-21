import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoInstalarVisible, DIAS_OCULTAR_INSTALAR, plataformaDe } from "../lib/instalar.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

test("instalar: reconoce iPhone, iPad (que se presenta como Mac) y Android; en el computador no", () => {
  assert.equal(plataformaDe(IPHONE, 5), "ios");
  assert.equal(plataformaDe(IPAD, 5), "ios");
  assert.equal(plataformaDe(IPAD, 0), "otro", "un Mac de verdad no tiene pantalla táctil");
  assert.equal(plataformaDe(ANDROID, 5), "android");
  assert.equal(plataformaDe(PC, 0), "otro");
});

test("instalar: no sale si ya está instalada, en el computador ni unos días tras «Ahora no»", () => {
  const ahora = new Date("2026-11-21T12:00:00Z");
  const base = { instalada: false, plataforma: "ios", ocultoEn: null, ahora };
  assert.equal(avisoInstalarVisible(base), true);
  assert.equal(avisoInstalarVisible({ ...base, instalada: true }), false);
  assert.equal(avisoInstalarVisible({ ...base, plataforma: "otro" }), false);
  assert.equal(avisoInstalarVisible({ ...base, ocultoEn: "2026-11-20T12:00:00Z" }), false);
  const viejo = new Date(ahora.getTime() - DIAS_OCULTAR_INSTALAR * 86_400_000).toISOString();
  assert.equal(avisoInstalarVisible({ ...base, ocultoEn: viejo }), true, "vuelve a salir pasados los días");
  assert.equal(avisoInstalarVisible({ ...base, ocultoEn: "basura" }), true);
});

test("instalar: el aviso está en Hoy (para quien anota sin señal) y en «Registrar sin señal»", () => {
  assert.match(readFileSync("app/(app)/page.tsx", "utf8"), /visibilidadMenu\([^)]*\)\.sinSenal \? <AvisoInstalar/);
  assert.match(readFileSync("components/campo/PantallaCampo.tsx", "utf8"), /<AvisoInstalar \/>/);
  assert.match(readFileSync("lib/offline/campo-db.ts", "utf8"), /navigator\.storage\?\.persist/, "se pide que no se borre lo guardado");
});
