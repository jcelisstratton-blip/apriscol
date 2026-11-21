import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoInstalarVisible, dentroDeApp, DIAS_OCULTAR_INSTALAR, navegadorDe, plataformaDe, RUTA_INSTALAR } from "../lib/instalar.ts";
import { menuFinca, visibilidadMenu } from "../lib/menu.ts";

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

test("instalar: un celular que pide el sitio de escritorio (se presenta como computador) sigue siendo celular", () => {
  const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  assert.equal(plataformaDe(LINUX, 5, true), "android", "pantalla táctil y puntero de dedo");
  assert.equal(plataformaDe(LINUX, 0, false), "otro", "un computador de verdad");
  assert.equal(plataformaDe("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", 5), "android", "la identificación reducida de Chrome dice Android");
});

test("instalar: reconoce el navegador y cuándo se abrió dentro de otra app", () => {
  assert.equal(navegadorDe(IPHONE), "Safari");
  assert.equal(navegadorDe(ANDROID), "Chrome");
  assert.equal(navegadorDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1"), "Chrome");
  assert.equal(navegadorDe("Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36"), "Samsung Internet");
  const whatsapp = "Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 WhatsApp/2.24";
  assert.equal(dentroDeApp(whatsapp), true);
  assert.equal(dentroDeApp(ANDROID), false);
  assert.equal(navegadorDe(whatsapp), "el navegador de otra app");
});

test("instalar: «Instalar la app» está en Mi finca para todos los roles, con su pantalla", () => {
  for (const rol of ["propietario", "administrador", "ordenador", "veterinario", "contador"]) {
    assert.ok(menuFinca(visibilidadMenu(rol, "hacienda")).some((e) => e.href === RUTA_INSTALAR), rol);
  }
  assert.match(readFileSync("app/(app)/mas/instalar/page.tsx", "utf8"), /<InstalarApp \/>/);
  assert.match(readFileSync("components/RegistrarSW.tsx", "utf8"), /import "@\/lib\/instalar-navegador"/, "el aviso del navegador se escucha desde que carga la app");
});
