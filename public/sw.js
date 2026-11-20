// Service worker de Apriscol — modo sin señal, paso 1. Hace UNA sola cosa:
//
//   Si una navegación falla por la red (sin señal en el potrero, el Wi‑Fi se cayó, el servidor no responde), muestra
//   /offline.html —con la marca, «Reintentar» y reintento automático— en lugar de la pantalla de error del navegador.
//
// Todo lo demás pasa tal cual a la red: NO se guarda en caché ninguna página, dato, foto ni sesión de la finca. Lo único guardado es
// la propia página sin conexión y el logo que muestra (iguales para todos, sin datos de nadie).
//
// Al cambiar la lista de lo guardado, subir la versión de CACHE: «activate» borra las cachés de versiones anteriores.
const CACHE = "apriscol-offline-v1";
const OFFLINE = "/offline.html";
const PRECARGA = [OFFLINE, "/logo.webp"];

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
    event.respondWith(navegar(event));
    return;
  }
  // El logo de la página sin conexión: va a la red como siempre y solo sale de la caché si no hay red.
  if (url.pathname === "/logo.webp") {
    event.respondWith(fetch(req).catch(async () => (await caches.match("/logo.webp")) || Response.error()));
  }
});
