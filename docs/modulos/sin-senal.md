# Modo sin señal

En el potrero o en el ordeño la señal entra y sale. El modo sin señal se construye por pasos; cada paso se puede desplegar solo y no cambia
cómo funciona lo demás de la app.

## Paso 1 — Service worker y página «Sin señal» (hecho, 20 nov 2026)

- **`public/sw.js`** (lo registra `components/RegistrarSW.tsx` desde `app/layout.tsx`, **solo en producción**). Hace una sola cosa: si una
  navegación (abrir una pantalla, recargar, seguir un enlace) **falla por la red**, muestra `public/offline.html` en lugar de la pantalla de error
  del navegador o del dinosaurio. Un 500 o una redirección al login son respuestas del servidor y se muestran tal cual: solo un fallo de red llega
  a la página sin conexión.
- **No guarda en caché ninguna pantalla, dato, foto ni sesión de la finca.** Lo único guardado es `offline.html` y `/logo.webp` (iguales para
  todos). Las consultas a Supabase, los envíos de formularios (POST), las acciones del servidor y `/_next/static` no pasan por el service worker.
- **Precarga de navegación** (`navigationPreload`): la pantalla se pide mientras el service worker arranca, así que con señal débil no agrega espera.
- **`public/offline.html`**: página autónoma (sin fuentes ni estilos de afuera: cuando se muestra no hay red) con el logo, los colores lana y
  musgo (claro y oscuro), «Reintentar» y **reintento automático** cada 5 s y al volver la conexión (`online`): pregunta por la misma dirección con
  `HEAD` (no pasa por el service worker) y, si responde, recarga. Cada intento tiene tiempo límite de 8 s.
- **`sw.js` y `offline.html` se sirven sin sesión**: están excluidos del `matcher` de `proxy.ts` (si no, el filtro de entrada los mandaría a `/login`).
- **Versión de la caché:** `CACHE = "apriscol-offline-vN"`. Si cambia la lista de lo que se guarda, se sube N; al activarse, el service worker
  borra las cachés `apriscol-*` anteriores.

### Límites conocidos

- Con señal **muy débil** la petición no falla, se queda colgada: el navegador espera su propio tiempo antes de rendirse. No se corta antes a
  propósito (una pantalla pesada con 2G puede tardar y ser válida).
- Lo que se estaba escribiendo en un formulario **sin enviar** se pierde si la persona navega sin señal: guardar sin señal es el paso siguiente.
- En desarrollo (`next dev`) no se registra.

### Para probar

`npm run build && npm start`, abrir la app con conexión una vez (se instala el service worker), **apagar el servidor** (la emulación de «sin red»
de las herramientas del navegador no siempre alcanza las peticiones del service worker) y recargar o abrir otra pantalla: debe salir «Sin señal».
Al volver a encender el servidor, la página recarga sola en menos de 5 s. Auditoría de celular a 360 y 320 px. Pruebas: `tests/sin-senal.test.mjs`
(carga `sw.js` en un entorno de service worker de mentira: qué guarda, qué deja pasar, qué responde sin red; y el `matcher`).

## Pasos siguientes (por definir)

- Capturar sin señal lo del campo (ordeño primero): bandeja local en IndexedDB y envío al volver la señal, idempotente por `client_request_id`
  (las funciones SQL ya lo son). Los datos nunca en el service worker.
- Dejar lista sin conexión la pantalla de captura (estática, igual para todos) con sus archivos de `/_next/static`.
