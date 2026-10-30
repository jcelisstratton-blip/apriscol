# Avisos por Telegram

Lo que hay que hacer cada día llega por Telegram a cada persona del equipo, según su rol. **Estado (30 oct 2026):** hechos la base de datos, el servidor del bot (webhook y despacho, probado en producción: `/hoy` responde) y la pantalla «Más → Telegram» de cada persona; faltan la pantalla del superadministrador y el flujo de n8n.

## Decisiones (del dueño del producto, 30 oct 2026)

- **Un solo bot de la plataforma:** `@apriscolbot` (nadie pone un token). Telegram exige que el usuario termine en «bot». El token es una variable de entorno del servidor (nunca en el repo) y solo lo configura el dueño. **Un token que se haya pegado en un chat o una captura hay que revocarlo** (@BotFather → `/revoke`) y poner el nuevo directo en el entorno.
- **Cada persona se vincula sola** desde la app: «Conectar Telegram» pide un código de un solo uso (8 caracteres, vale 15 minutos, se guarda solo su hash) y lo envía al bot como `/start CODIGO`. Un chat no puede estar en dos personas de la misma finca. Chat 1 a 1: nada de grupos.
- **n8n dispara, Apriscol decide y envía.** Un solo workflow para todas las fincas, en una carpeta o proyecto de n8n llamado **apriscol** y con nombres «APRISCOL — …», separado de los flujos de Stratt-On. Cada 15 minutos llama a `POST /api/notificaciones/despachar` con `Authorization: Bearer <DESPACHO_SECRET>` y vigila que responda bien. Apriscol arma el texto con las mismas reglas que Hoy y Semáforos (`cargarSemaforos`, `areasSemaforo`), reserva el envío, lo manda a Telegram y anota el resultado: el token vive en un solo lugar y «reservado → enviado» no depende de un viaje entre sistemas.
- **Los parámetros viven en la base de datos, no en el cron.** El cron es fijo (cada 15 minutos); la tabla `notificacion_preferencias` dice, por persona, cuándo y qué recibe. En el piloto los fija solo el **superadministrador**.
- **Cómo corre la lógica sin sesión:** el servidor usa la llave secreta de Supabase (`sb_secret_…`, solo para las funciones del bot) y, para armar el resumen de una persona, le pide a Supabase una sesión **de esa persona** (`auth.admin.generateLink` de tipo magiclink + `verifyOtp`, sin correo, canjeada en el acto y cerrada al terminar con `signOut`). Así `cargarSemaforos` corre con su rol y la seguridad por finca de siempre, y las funciones que validan `auth.uid()` se comportan igual que en la app. **No se firman tokens a mano:** se intentó con el secreto JWT heredado (HS256) y Supabase lo rechaza (`No suitable key or wrong key type`) porque el proyecto ya firma con ECC (P-256); el HS256 quedó solo para verificar sesiones viejas. Costo: tres llamadas cortas por persona y una entrada de inicio de sesión en Supabase por cada resumen.

## Datos (`20261030131339_notificaciones_telegram`)

| Tabla | Qué guarda | Quién la lee |
|---|---|---|
| `telegram_vinculos` | chat de cada persona por finca, estado (`pendiente`, `activo`, `pausado`, `bloqueado`), hash del código vigente | la persona ve lo suyo (sin `codigo_hash` ni `chat_id`: columnas sin permiso) |
| `notificacion_preferencias` | activo, resumen y su hora, días ISO 1–7, nivel mínimo (`rojo`/`ambar`), alertas, semanal, silencio, tope diario | la persona ve lo suyo; solo el superadministrador escribe |
| `notificacion_envios` | un registro por aviso (`tipo` + `clave`, única por persona): evita repetir y deja rastro; hasta 3 intentos | solo el servidor |

Funciones: `telegram_crear_codigo` y `telegram_desvincular` (la persona); `admin_notificaciones` y `admin_guardar_notificaciones` (superadministrador, validan `es_admin_plataforma`); `telegram_vincular`, `telegram_chat_estado`, `notificaciones_destinos`, `notificacion_reservar`, `notificacion_resultado` (**solo `service_role`**). `notificaciones_destinos(p_ahora)` calcula con la hora de Bogotá a quién le toca el resumen: activo, día elegido, ya pasó su hora (margen de 3 horas), sin envío de hoy; un fallo se reintenta hasta 3 veces. Límite conocido: un resumen programado después de las 21:00 no cuenta bien su margen (cruza la medianoche).

Probado con transacciones que se deshacen (propietario, ajeno, superadministrador, servidor): código, vinculación una sola vez, permisos, ventana horaria, envío único, reintento y bloqueo.

## Servidor del bot (`lib/notificaciones/`, `app/api/telegram`, `app/api/notificaciones`)

- `telegram.ts` (comandos, secreto, envío con detección de bloqueo); `mensajes.ts` (`armarResumen`: rojo primero, ámbar según el nivel mínimo, hasta 12 casos con enlace al punto exacto, 4096 caracteres como tope); `servidor.ts` (`despachar`, `atenderEvento`, `simularResumen`). Pruebas en `tests/notificaciones.test.mjs`.
- `POST /api/telegram/webhook`: exige `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`. Atiende `/start CODIGO` (vincula), `/hoy`, `/pausar`, `/reanudar` y `/ayuda`; solo chat privado. Un 403 al enviar o un `kicked` pausan el vínculo como `bloqueado`.
- `POST /api/notificaciones/despachar`: exige `Bearer DESPACHO_SECRET`. Sin cuerpo manda lo que toca ahora; con `{"simular":{"finca_id","user_id"}}` devuelve el resumen de esa persona **sin enviarlo ni anotarlo** (para probar el circuito).
- Rutas públicas para el filtro de sesión (`lib/supabase/proxy.ts`): las protege su secreto. Si falta una variable, responden 503. Errores en los registros de Vercel con la marca `[apriscol:telegram]`.
- **Variables (solo servidor, Vercel y nunca en el repo):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DESPACHO_SECRET`, `SUPABASE_SECRET_KEY` (Supabase → API Keys → Secret keys; ve todo, tratarla como el token) y, público y opcional, `NEXT_PUBLIC_TELEGRAM_BOT` (por defecto `apriscolbot`).
- **Registrar el webhook** (una vez, con el secreto elegido): `curl -sS "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://apriscol.shop/api/telegram/webhook" -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" -d 'allowed_updates=["message","my_chat_member"]'`.
- **Sin probar contra Telegram ni Supabase real desde el entorno de desarrollo** (no llega a esos hosts). La primera prueba es `simular` con `curl`: si responde el texto, el circuito está bien; si no, dice en qué paso falló. **Aprendizaje:** una respuesta «todavía no estás vinculado» puede esconder un error de la base; por eso `/hoy` registra y responde distinto cuando la consulta falla.

## Pantalla de la persona (`/mas/telegram`, entrada «Telegram» de Mi finca, para todos los roles)

`ConectarTelegram` pide un código (`crearCodigoTelegram` → `telegram_crear_codigo`), abre `t.me/<bot>?start=<código>` y revisa cada 4 segundos si la conexión se confirmó (mientras el código vale, 15 minutos). Muestra el estado (Conectado, Pausado, Bot bloqueado, Sin conectar), lo que va a recibir (`describirAvisos`, a partir de los parámetros que fijó el equipo) y permite desconectar con confirmación. La app solo lee el **estado** del vínculo: el código y el chat no tienen permiso de lectura. El usuario del bot sale de `NEXT_PUBLIC_TELEGRAM_BOT` (por defecto `apriscolbot`; no es un secreto). Está omitida de la presentación (`lib/presentacion.ts`) mientras sea piloto.

## Cómo se ve el resumen (`lib/notificaciones/mensajes.ts`)

Arriba, finca, fecha y saludo; luego los totales (🔴 vencidos o urgentes · 🟠 pendientes); luego **un bloque por área** (las que tienen algo vencido primero) con **una línea por tarea y su cantidad**, y debajo **botones de enlace** (uno por área con su cantidad, más «Abrir Hoy» y «Ver semáforos»). Lo que tiene fecha límite (`ItemSenal.atrasoDias`, hoy las dosis y programas) se separa en «vencidas» (con la más atrasada: «hace 324 días») y «pendientes»; el resto muestra hasta 3 nombres (sin el arete, con enlace a la ficha) y «y N más». El detalle largo (qué hacer con cada animal) queda en la app. Si no cabe en 4096 caracteres se quitan los nombres y quedan las tareas con su cantidad. Los botones solo se envían con una dirección `https` (Telegram rechaza `localhost`); si Telegram los rechaza, el mensaje se reenvía sin ellos.

**Dirección de los enlaces:** `SITE_URL` (`lib/env.ts`) usa `NEXT_PUBLIC_SITE_URL` si existe; si no, en producción `https://$VERCEL_PROJECT_PRODUCTION_URL` (o `https://apriscol.shop`) y solo en desarrollo `http://localhost:3000`. Antes caía siempre a localhost en producción porque la variable no está en Vercel.

## Qué recibe cada rol (el alcance sale de `areasSemaforo`)

- **Propietario y administrador:** lo más urgente en rojo y ámbar, partos de la semana, compras por pagar y ventas por cobrar vencidas, novedades sin atender e inventario crítico (el administrador, además, las novedades «Comprar», el alimento y el mantenimiento de la sala).
- **Veterinario:** dosis y programas del día con sus animales, partos a vigilar, diagnósticos en ventana, FAMACHA y coprológico, retiros, pruebas, cuarentena, pezuñas, vacunas anuales, novedades «aplicar dosis» y medicamentos vencidos o en mínimo. Nada de dinero.
- **Ordeñador:** corto y llano: leche en retiro que se descarta hoy, hembras por secar, frío, mantenimiento de la sala, alimento que se acaba, producción que baja y su turno. Nada de dinero.
- **Contador:** compras por pagar y ventas por cobrar. Nada del hato.

Reglas contra el ruido: una alerta no se repite si no cambió, tope diario por persona, silencio nocturno (salvo un rojo crítico), hasta 5 aretes más «y N más» con enlace al punto exacto, y el nombre de la finca cuando la persona está en varias.

## Pendiente

1. Poner las variables en Vercel, registrar el webhook y probar `simular`.
2. Pantalla del superadministrador para los parámetros (`admin_notificaciones`, `admin_guardar_notificaciones`). Mientras no exista, los parámetros del piloto se fijan con la función desde el Editor SQL.
3. Workflow de n8n (carpeta apriscol) con el Schedule de 15 minutos.
4. Alertas con dedupe, recordatorios con hora y resumen semanal.
5. Validar con el veterinario qué es «lo que hay que hacer hoy» para cada rol.
