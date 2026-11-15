import test from "node:test";
import assert from "node:assert/strict";
import { ANCHO_ESCRITORIO, CLAVE_AL_GRANO_VISTO, DIAS_AVISO_AL_GRANO, EVENTO_ABRIR_AL_GRANO, EVENTO_AL_GRANO_VISTO, abrirAlGrano, avisoAlGranoVisible, marcarAlGranoVisto } from "../lib/al-grano.ts";

test("aviso de «Al grano»: lo ve la persona durante su primer mes (inclusive) y deja de verlo después", () => {
  assert.equal(DIAS_AVISO_AL_GRANO, 30);
  assert.equal(avisoAlGranoVisible(0), true);
  assert.equal(avisoAlGranoVisible(30), true);
  assert.equal(avisoAlGranoVisible(31), false);
  assert.equal(avisoAlGranoVisible(400), false);
});

test("aviso de «Al grano»: los nombres de claves y eventos son estables y el escritorio empieza en 1024 px (lg)", () => {
  assert.equal(CLAVE_AL_GRANO_VISTO, "apriscol:al-grano-visto");
  assert.equal(EVENTO_AL_GRANO_VISTO, "apriscol:al-grano-visto");
  assert.equal(EVENTO_ABRIR_AL_GRANO, "apriscol:abrir-al-grano");
  assert.equal(ANCHO_ESCRITORIO, 1024);
});

test("aviso de «Al grano»: sin navegador (servidor) marcar y abrir no fallan", () => {
  assert.doesNotThrow(() => marcarAlGranoVisto());
  assert.doesNotThrow(() => abrirAlGrano());
});

test("aviso de «Al grano»: abrir pide la hoja del menú que se está viendo, y marcar guarda y avisa", () => {
  const guardado = new Map();
  const eventos = [];
  globalThis.window = {
    dispatchEvent: (e) => (eventos.push(e), true),
    matchMedia: (q) => ({ matches: q.includes("1024") }),
  };
  globalThis.localStorage = { setItem: (k, v) => guardado.set(k, v), getItem: (k) => guardado.get(k) ?? null };
  globalThis.CustomEvent = class { constructor(tipo, init) { this.type = tipo; this.detail = init?.detail; } };
  globalThis.Event = class { constructor(tipo) { this.type = tipo; } };
  try {
    marcarAlGranoVisto();
    assert.equal(guardado.get(CLAVE_AL_GRANO_VISTO), "1");
    assert.equal(eventos.at(-1).type, EVENTO_AL_GRANO_VISTO);
    abrirAlGrano();
    assert.equal(eventos.at(-1).type, EVENTO_ABRIR_AL_GRANO);
    assert.equal(eventos.at(-1).detail.escritorio, true);
  } finally {
    delete globalThis.window; delete globalThis.localStorage; delete globalThis.CustomEvent; delete globalThis.Event;
  }
});
