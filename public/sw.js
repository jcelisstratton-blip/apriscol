// Service worker de Apriscol — modo sin señal (ver docs/modulos/sin-senal.md). Hace SOLO dos cosas:
//
//  1. Si una navegación falla por la red (sin señal en el potrero, el Wi‑Fi se cayó, el servidor no responde), muestra /offline.html
//     —con la marca, «Reintentar» y reintento automático— en lugar de la pantalla de error del navegador.
//
//  2. Deja lista /campo («Registrar sin señal»: ordeño y pesos) para abrirla sin conexión. /campo es una página ESTÁTICA, igual para
//     todas las personas: no lleva datos de nadie (la copia de la finca y lo registrado viven en IndexedDB, en el código de la página), por
//     eso es seguro guardarla. Se guardan también los archivos de /_next/static que usa: son inmutables (su nombre lleva el hash).
//
// NO se guarda en caché ninguna otra pantalla, dato, foto ni sesión de la finca.
//
// Al cambiar la lista de lo guardado, subir la versión de CACHE: «activate» borra las cachés de versiones anteriores.
const CACHE = "apriscol-offline-v2";
const OFFLINE = "/offline.html";
const CAMPO = "/campo";
const LOGO = "/logo.webp";
const PRECARGA = [OFFLINE, LOGO];
// Con señal débil la petición no falla, se queda colgada: pasado este tiempo, /campo sale de la copia guardada.
const ESPERA_RED_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECARGA.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k.startsWith("apriscol-") && k !== CACHE).map((k) => caches.delete(k)));
      // La precarga de navegación pide la página mientras el service worker arranca: con señal débil no suma ni un instante de espera.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })()
  );
});

const desescapar = (t) => t.replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");

// Direcciones de /_next/static que menciona un documento (HTML o CSS): scripts, estilos, fuentes y los trozos de código que lista el RSC.
function recursosEstaticos(texto, base) {
  const urls = new Set();
  for (const m of desescapar(texto).matchAll(/(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\\\s)<>]+)/g)) urls.add(new URL("/_next/" + m[1], base).href);
  return [...urls];
}

// `inmutable`: los archivos de /_next/static llevan el hash del contenido en el nombre; si ya están guardados no se vuelven a pedir.
async function guardarSiOk(cache, url, inmutable = false) {
  if (inmutable) {
    const ya = await cache.match(url);
    if (ya) return ya;
  }
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (res.ok && res.type === "basic") {
      await cache.put(url, res.clone());
      return res;
    }
  } catch {
    // sin red: se intentará la próxima vez
  }
  return null;
}

// Pide /campo con conexión, la guarda junto con todo lo que necesita y borra lo que quedó de versiones anteriores.
async function prepararCampo() {
  const cache = await caches.open(CACHE);
  let res;
  try {
    // redirect:"manual": sin sesión el filtro de entrada redirige al login; eso NO se guarda como si fuera /campo.
    res = await fetch(CAMPO, { credentials: "same-origin", redirect: "manual", cache: "reload" });
  } catch {
    return;
  }
  if (!res.ok || res.type !== "basic" || !(res.headers.get("content-type") || "").includes("text/html")) return;
  const html = await res.clone().text();
  const vigentes = new Set(recursosEstaticos(html, self.location.origin));
  // Los estilos mencionan las fuentes: se cargan primero para sumarlas a lo vigente.
  for (const u of [...vigentes].filter((x) => x.includes("/static/css/"))) {
    const css = await guardarSiOk(cache, u, true);
    if (css) for (const f of recursosEstaticos(await css.clone().text(), self.location.origin)) vigentes.add(f);
  }
  await Promise.all([...vigentes].filter((u) => !u.includes("/static/css/")).map((u) => guardarSiOk(cache, u, true)));
  // El documento se guarda al final: si algo de arriba falló a medias, la copia vieja (completa) sigue valiendo.
  await cache.put(CAMPO, res);
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (u.pathname.startsWith("/_next/static/") && !vigentes.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.tipo === "preparar-campo") event.waitUntil(prepararCampo());
});

// /campo: red primero con tiempo límite; si falla, tarda o responde con error del servidor, la copia guardada.
async function campoRedPrimero(event) {
  const guardada = () => caches.match(CAMPO);
  try {
    const res = await Promise.race([
      (async () => (await event.preloadResponse) || fetch(event.request))(),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("tiempo")), ESPERA_RED_MS)),
    ]);
    if (res.status >= 500) return (await guardada()) || res;
    // Un 200 se guarda al instante; una redirección al login (sesión vencida) se devuelve tal cual, sin guardar.
    if (res.ok && res.type === "basic") {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(CAMPO, copia)).catch(() => {});
    }
    return res;
  } catch {
    return (await guardada()) || (await caches.match(OFFLINE)) || Response.error();
  }
}

async function navegar(event) {
  try {
    const precargada = await event.preloadResponse;
    if (precargada) return precargada;
    return await fetch(event.request);
  } catch {
    // Solo un fallo de RED llega aquí. Un 500 o una redirección al login son respuestas: se muestran tal cual.
    return (await caches.match(OFFLINE)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(url.pathname === CAMPO ? campoRedPrimero(event) : navegar(event));
    return;
  }
  // Archivos inmutables que /campo dejó guardados: salen de la caché si están; si no, a la red como siempre.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  // El logo de las páginas sin conexión: va a la red como siempre y solo sale de la caché si no hay red.
  if (url.pathname === LOGO) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(LOGO)) || Response.error()));
  }
});
