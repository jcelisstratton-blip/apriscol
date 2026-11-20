import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

/**
 * Una respuesta de mentira: `cuerpo` (texto), estado, tipo y content-type. Se puede leer y clonar como una de verdad.
 * `redireccion: true` imita la respuesta de `redirect: "manual"` (tipo «opaqueredirect», estado 0).
 */
function respuesta(cuerpo, { status = 200, tipo = "text/html", redireccion = false } = {}) {
  const r = {
    cuerpo,
    status: redireccion ? 0 : status,
    ok: !redireccion && status >= 200 && status < 300,
    type: redireccion ? "opaqueredirect" : "basic",
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? tipo : null) },
    clone: () => respuesta(cuerpo, { status, tipo, redireccion }),
    text: async () => String(cuerpo),
  };
  return r;
}
const pagina = (cuerpo) => respuesta(cuerpo);
const sinRed = () => Promise.reject(new TypeError("Failed to fetch"));

/** Carga public/sw.js en un entorno de service worker de mentira: caché en memoria y una red que responde o falla a voluntad. */
function cargarSW({ red, tiempoAgotado = () => false }) {
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
      match: async (r) => m.get(ruta(r)),
      keys: async () => [...m.keys()].map((k) => ({ url: new URL(k, "https://apriscol.test").href })),
      delete: async (r) => m.delete(ruta(r)),
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
  // El tiempo límite de /campo: solo «vence» cuando la prueba lo pide (así nada espera 4 s de verdad).
  const setTimeout = (fn) => (tiempoAgotado() ? Promise.resolve().then(fn) : 0);
  const fetch = (r) => red(typeof r === "string" ? { url: new URL(r, "https://apriscol.test").href } : r);
  const contexto = { self, caches, fetch, setTimeout, Request: class { constructor(url) { this.url = new URL(url, "https://apriscol.test").href; } }, Response: { error: () => ({ error: true }) }, URL, Promise, Set };
  vm.runInNewContext(leer("public/sw.js"), contexto);

  const ciclo = async (tipo, extra = {}) => {
    let espera = null;
    let resp;
    const evento = { ...extra, waitUntil: (p) => (espera = p), respondWith: (p) => (resp = p) };
    for (const fn of oyentes[tipo] ?? []) fn(evento);
    await espera;
    return resp === undefined ? "a-la-red" : await resp;
  };
  return {
    cajas,
    guardado: () => [...(cajas.get(CACHE)?.keys() ?? [])].sort(),
    instalar: async () => {
      await ciclo("install");
      await ciclo("activate");
    },
    mensaje: (data) => ciclo("message", { data }),
    pedir: (url, { mode = "navigate", method = "GET", preloadResponse = Promise.resolve(undefined) } = {}) =>
      ciclo("fetch", { request: { url: new URL(url, "https://apriscol.test").href, mode, method }, preloadResponse }),
  };
}

const CACHE = "apriscol-offline-v2";
const cuerpo = (r) => r?.cuerpo;

test("sin señal: al instalarse guarda solo la página sin conexión y el logo, y borra la caché de la versión anterior", async () => {
  const sw = cargarSW({ red: async (r) => pagina(r.url) });
  sw.cajas.set("apriscol-offline-v1", new Map([["/offline.html", pagina("vieja")]]));
  sw.cajas.set("otra-app", new Map());
  await sw.instalar();
  assert.deepEqual([...sw.cajas.keys()].sort(), [CACHE, "otra-app"], "solo se borran las cachés propias viejas");
  assert.deepEqual(sw.guardado(), ["/logo.webp", "/offline.html"]);
});

test("sin señal: con red, la navegación es la respuesta real y no se guarda nada", async () => {
  const sw = cargarSW({ red: async (r) => pagina(`red:${new URL(r.url).pathname}`) });
  await sw.instalar();
  assert.equal(cuerpo(await sw.pedir("/hato")), "red:/hato");
  assert.deepEqual(sw.guardado(), ["/logo.webp", "/offline.html"], "ninguna página del hato queda en caché");
  // La precarga de navegación se usa si llegó.
  assert.equal(cuerpo(await sw.pedir("/leche", { preloadResponse: Promise.resolve(pagina("precarga")) })), "precarga");
});

test("sin señal: si la red falla, cualquier navegación muestra offline.html", async () => {
  let enLinea = true;
  const sw = cargarSW({ red: async (r) => (enLinea ? pagina(new URL(r.url).pathname) : sinRed()) });
  await sw.instalar();
  enLinea = false;
  assert.equal(cuerpo(await sw.pedir("/hato/123")), "/offline.html");
  assert.equal(cuerpo(await sw.pedir("/leche", { preloadResponse: sinRed() })), "/offline.html");
  // El logo de esa página sale de la caché.
  assert.equal(cuerpo(await sw.pedir("/logo.webp", { mode: "no-cors" })), "/logo.webp");
});

test("sin señal: datos, envíos y otros sitios no pasan por el service worker", async () => {
  const sw = cargarSW({ red: async (r) => pagina(r.url) });
  await sw.instalar();
  assert.equal(await sw.pedir("/hato", { method: "POST" }), "a-la-red");
  assert.equal(await sw.pedir("/api/campo/enviar", { method: "POST", mode: "cors" }), "a-la-red");
  assert.equal(await sw.pedir("/api/campo/referencia", { mode: "cors" }), "a-la-red");
  assert.equal(await sw.pedir("https://xyz.supabase.co/rest/v1/animales", { mode: "cors" }), "a-la-red");
});

/** Una red con /campo y sus archivos de /_next/static (el HTML menciona un script y un estilo; el estilo, una fuente). */
function redConCampo(estado) {
  const html = '<html><script src="/_next/static/chunks/app-1.js"></script><link href="/_next/static/css/a-1.css" rel="stylesheet"></html>';
  return async (r) => {
    if (!estado.enLinea) return sinRed();
    const p = new URL(r.url).pathname;
    if (estado.colgada) return new Promise(() => {});
    if (p === "/campo") return estado.sinSesion ? respuesta("", { redireccion: true }) : estado.caido ? respuesta("error", { status: 503 }) : respuesta(estado.html ?? html);
    if (p === "/_next/static/css/a-1.css") return respuesta("@font-face{src:url(/_next/static/media/f-1.woff2)}", { tipo: "text/css" });
    if (p.startsWith("/_next/static/")) return respuesta(`archivo:${p}`, { tipo: "application/javascript" });
    return pagina(p);
  };
}

test("registrar sin señal: con sesión deja lista /campo con sus scripts, estilos y fuentes; nada más", async () => {
  const estado = { enLinea: true };
  const sw = cargarSW({ red: redConCampo(estado) });
  await sw.instalar();
  await sw.mensaje({ tipo: "preparar-campo" });
  assert.deepEqual(sw.guardado(), ["/_next/static/chunks/app-1.js", "/_next/static/css/a-1.css", "/_next/static/media/f-1.woff2", "/campo", "/logo.webp", "/offline.html"]);
  // Un mensaje cualquiera no hace nada.
  await sw.mensaje({ tipo: "otra-cosa" });
  await sw.mensaje(null);
});

test("registrar sin señal: sin sesión (redirección al login) no se guarda /campo", async () => {
  const estado = { enLinea: true, sinSesion: true };
  const sw = cargarSW({ red: redConCampo(estado) });
  await sw.instalar();
  await sw.mensaje({ tipo: "preparar-campo" });
  assert.deepEqual(sw.guardado(), ["/logo.webp", "/offline.html"]);
});

test("registrar sin señal: sin red, con la señal colgada o con el servidor caído, /campo abre desde el celular", async () => {
  const estado = { enLinea: true };
  let agotado = false;
  const sw = cargarSW({ red: redConCampo(estado), tiempoAgotado: () => agotado });
  await sw.instalar();
  await sw.mensaje({ tipo: "preparar-campo" });
  const guardada = cuerpo(await sw.pedir("/campo"));
  assert.match(guardada, /app-1\.js/);

  estado.enLinea = false;
  assert.equal(cuerpo(await sw.pedir("/campo")), guardada, "sin red");
  assert.equal(cuerpo(await sw.pedir("/campo#bandeja")), guardada, "con el ancla de la bandeja");
  assert.equal(cuerpo(await sw.pedir("/_next/static/chunks/app-1.js", { mode: "no-cors" })), "archivo:/_next/static/chunks/app-1.js", "sus archivos salen de la caché");

  estado.enLinea = true;
  estado.colgada = true;
  agotado = true;
  assert.equal(cuerpo(await sw.pedir("/campo")), guardada, "señal colgada: pasado el tiempo límite");

  estado.colgada = false;
  agotado = false;
  estado.caido = true;
  assert.equal(cuerpo(await sw.pedir("/campo")), guardada, "servidor caído (5xx)");
});

test("registrar sin señal: con red /campo se renueva; una redirección al login se muestra y no reemplaza la copia", async () => {
  const estado = { enLinea: true };
  const sw = cargarSW({ red: redConCampo(estado) });
  await sw.instalar();
  await sw.mensaje({ tipo: "preparar-campo" });
  estado.html = "<html>nueva versión</html>";
  assert.equal(cuerpo(await sw.pedir("/campo")), "<html>nueva versión</html>");
  await new Promise((r) => setImmediate(r));
  assert.equal(cuerpo(sw.cajas.get(CACHE).get("/campo")), "<html>nueva versión</html>", "la copia se renueva con cada visita con red");
  estado.sinSesion = true;
  const redir = await sw.pedir("/campo");
  assert.equal(redir.type, "opaqueredirect");
  assert.equal(cuerpo(sw.cajas.get(CACHE).get("/campo")), "<html>nueva versión</html>");
});

test("registrar sin señal: sin haberla preparado, /campo sin red muestra la página «Sin señal»", async () => {
  const estado = { enLinea: true };
  const sw = cargarSW({ red: redConCampo(estado) });
  await sw.instalar();
  estado.enLinea = false;
  assert.equal(cuerpo(await sw.pedir("/campo")), "/offline.html");
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
  for (const r of html.matchAll(/(?:src|href)=["'](\/[^"']*)["']/g)) assert.ok(["/logo.webp", "/campo"].includes(r[1]), `${r[1]} no está en la caché del service worker`);
  assert.match(html, /Reintentar/);
  const layout = leer("app/layout.tsx");
  assert.match(layout, /<RegistrarSW \/>/);
  assert.match(leer("components/RegistrarSW.tsx"), /register\("\/sw\.js"/);
});

test("sin señal: cabeceras — sw.js nunca en caché HTTP y la política de contenido permite el service worker y la página sin conexión", async () => {
  const { cabecerasModoSinSenal, politicaDeContenido } = await import("../lib/cabeceras-seguridad.ts");
  const por = Object.fromEntries(cabecerasModoSinSenal().map((r) => [r.source, Object.fromEntries(r.headers.map((h) => [h.key, h.value]))]));
  assert.match(por["/sw.js"]["Cache-Control"], /no-store/);
  assert.equal(por["/sw.js"]["Service-Worker-Allowed"], "/");
  assert.match(por["/offline.html"]["Cache-Control"], /no-cache/);
  assert.match(leer("next.config.ts"), /\.\.\.cabecerasModoSinSenal\(\)/);
  const csp = Object.fromEntries(politicaDeContenido("https://abc.supabase.co").split("; ").map((d) => [d.split(" ")[0], d]));
  assert.match(csp["worker-src"], /'self'/);
  // Lo que usa offline.html (script y estilo en línea, imagen propia, HEAD a la misma dirección) cabe en la política aunque bloquee de verdad.
  assert.match(csp["script-src"], /'unsafe-inline'/);
  assert.match(csp["style-src"], /'unsafe-inline'/);
  assert.match(csp["img-src"], /'self'/);
  assert.match(csp["connect-src"], /'self'/);
});
