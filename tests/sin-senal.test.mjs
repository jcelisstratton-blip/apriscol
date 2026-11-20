import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

/** Carga public/sw.js en un entorno de service worker de mentira: caché en memoria y una red que responde o falla a voluntad. */
function cargarSW({ red }) {
  const oyentes = {};
  const cajas = new Map(); // nombre de la caché → Map(ruta → respuesta)
  const ruta = (r) => new URL(typeof r === "string" ? r : r.url, "https://apriscol.test").pathname;
  const caja = (nombre) => {
    if (!cajas.has(nombre)) cajas.set(nombre, new Map());
    const m = cajas.get(nombre);
    return {
      addAll: async (reqs) => {
        for (const r of reqs) m.set(ruta(r), await red(r));
      },
      put: async (r, res) => void m.set(ruta(r), res),
    };
  };
  const caches = {
    open: async (n) => caja(n),
    keys: async () => [...cajas.keys()],
    delete: async (n) => cajas.delete(n),
    match: async (r) => {
      for (const m of cajas.values()) if (m.has(ruta(r))) return m.get(ruta(r));
      return undefined;
    },
  };
  const self = {
    location: new URL("https://apriscol.test/"),
    registration: { navigationPreload: { enable: async () => {} } },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (tipo, fn) => (oyentes[tipo] ??= []).push(fn),
  };
  const contexto = { self, caches, fetch: (r) => red(r), Request: class { constructor(url) { this.url = new URL(url, "https://apriscol.test").href; } }, Response: { error: () => ({ error: true }) }, URL, Promise };
  vm.runInNewContext(leer("public/sw.js"), contexto);

  const ciclo = async (tipo, extra = {}) => {
    let espera = null;
    let respuesta;
    const evento = { ...extra, waitUntil: (p) => (espera = p), respondWith: (p) => (respuesta = p) };
    for (const fn of oyentes[tipo] ?? []) fn(evento);
    await espera;
    return respuesta === undefined ? "a-la-red" : await respuesta;
  };
  return {
    cajas,
    instalar: async () => {
      await ciclo("install");
      await ciclo("activate");
    },
    pedir: (url, { mode = "navigate", method = "GET", preloadResponse = Promise.resolve(undefined) } = {}) =>
      ciclo("fetch", { request: { url: new URL(url, "https://apriscol.test").href, mode, method }, preloadResponse }),
  };
}

const pagina = (cuerpo) => ({ ok: true, cuerpo });

test("sin señal: al instalarse guarda solo la página sin conexión y el logo", async () => {
  const sw = cargarSW({ red: async (r) => pagina(r.url) });
  await sw.instalar();
  assert.deepEqual([...sw.cajas.keys()], ["apriscol-offline-v1"]);
  assert.deepEqual([...sw.cajas.get("apriscol-offline-v1").keys()].sort(), ["/logo.webp", "/offline.html"]);
});

test("sin señal: con red, la navegación es la respuesta real y no se guarda nada", async () => {
  let enLinea = true;
  const sw = cargarSW({ red: async (r) => (enLinea ? pagina(`red:${new URL(r.url).pathname}`) : Promise.reject(new TypeError("Failed to fetch"))) });
  await sw.instalar();
  assert.deepEqual(await sw.pedir("/hato"), pagina("red:/hato"));
  assert.equal(sw.cajas.get("apriscol-offline-v1").size, 2, "ninguna página del hato queda en caché");
  // La precarga de navegación se usa si llegó.
  assert.deepEqual(await sw.pedir("/leche", { preloadResponse: Promise.resolve(pagina("precarga")) }), pagina("precarga"));
});

test("sin señal: si la red falla, cualquier navegación muestra offline.html", async () => {
  let enLinea = true;
  const sw = cargarSW({ red: async (r) => (enLinea ? pagina(new URL(r.url).pathname) : Promise.reject(new TypeError("Failed to fetch"))) });
  await sw.instalar();
  enLinea = false;
  assert.deepEqual(await sw.pedir("/hato/123"), pagina("/offline.html"));
  assert.deepEqual(await sw.pedir("/leche", { preloadResponse: Promise.reject(new TypeError("Failed to fetch")) }), pagina("/offline.html"));
  // El logo de esa página sale de la caché.
  assert.deepEqual(await sw.pedir("/logo.webp", { mode: "no-cors" }), pagina("/logo.webp"));
});

test("sin señal: datos, envíos y otros sitios no pasan por el service worker", async () => {
  const sw = cargarSW({ red: async (r) => pagina(r.url) });
  await sw.instalar();
  assert.equal(await sw.pedir("/hato", { method: "POST" }), "a-la-red");
  assert.equal(await sw.pedir("/api/csp", { mode: "cors" }), "a-la-red");
  assert.equal(await sw.pedir("/_next/static/chunks/a.js", { mode: "no-cors" }), "a-la-red");
  assert.equal(await sw.pedir("https://xyz.supabase.co/rest/v1/animales", { mode: "cors" }), "a-la-red");
});

test("sin señal: sw.js y offline.html se sirven sin sesión; las pantallas siguen pasando por el filtro de entrada", () => {
  const literal = leer("proxy.ts").match(/matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)?("(?:[^"\\]|\\.)*")/)?.[1];
  assert.ok(literal, "no encontré el matcher de proxy.ts");
  const patron = new RegExp(`^${JSON.parse(literal)}$`);
  for (const r of ["/sw.js", "/offline.html", "/logo.webp"]) assert.ok(!patron.test(r), `${r} no debe pedir sesión`);
  for (const r of ["/", "/hato", "/leche", "/sw.jsx", "/offline.html/x"]) assert.ok(patron.test(r), `${r} sí pasa por el filtro`);
});

test("sin señal: offline.html no depende de nada de afuera y el layout registra el service worker", () => {
  const html = leer("public/offline.html");
  assert.ok(!/(?:src|href)=["'](?:https?:)?\/\//i.test(html), "nada de fuentes, estilos ni scripts de otro sitio");
  assert.ok(!/@import|url\(/i.test(html), "sin recursos externos en los estilos");
  for (const r of html.matchAll(/(?:src|href)=["'](\/[^"']*)["']/g)) assert.ok(["/logo.webp"].includes(r[1]), `${r[1]} no está en la caché del service worker`);
  assert.match(html, /Reintentar/);
  const layout = leer("app/layout.tsx");
  assert.match(layout, /<RegistrarSW \/>/);
  assert.match(leer("components/RegistrarSW.tsx"), /register\("\/sw\.js"/);
});
