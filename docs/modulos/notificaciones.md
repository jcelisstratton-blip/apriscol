# Avisos por Telegram

Lo que hay que hacer cada día llega por Telegram a cada persona del equipo, según su rol. **Estado:** primera entrega de base de datos (30 oct 2026); faltan el servidor del bot, la pantalla y el flujo de n8n.

## Decisiones (del dueño del producto, 30 oct 2026)

- **Un solo bot de la plataforma** (nadie pone un token). El nombre lo elige el dueño; Telegram exige que el usuario del bot **termine en «bot»** (por ejemplo `apriscol_bot` o `ApriscolBot`; `botapriscol` no se acepta). El token es una variable de entorno del servidor (nunca en el repo) y se pide al dueño solo para configurar el bot, no a los clientes.
- **Cada persona se vincula sola** desde la app: «Conectar Telegram» pide un código de un solo uso (8 caracteres, vale 15 minutos, se guarda solo su hash) y lo envía al bot como `/start CODIGO`. Un chat no puede estar en dos personas de la misma finca. Chat 1 a 1: nada de grupos.
- **n8n despacha, Apriscol decide.** Un solo workflow para todas las fincas, en una carpeta o proyecto de n8n llamado **apriscol** y con nombres «APRISCOL — …», separado de los flujos de Stratt-On. Cada 15 minutos pregunta a Apriscol qué mensajes toca enviar, los manda con Telegram y devuelve el resultado. El texto de cada mensaje lo arma Apriscol con las mismas reglas que Hoy y Semáforos (`cargarSemaforos`, `areasSemaforo`), para que nunca se contradigan.
- **Los parámetros viven en la base de datos, no en el cron.** El cron es fijo (cada 15 minutos); la tabla `notificacion_preferencias` dice, por persona, cuándo y qué recibe. En el piloto los fija solo el **superadministrador**.
- **Cómo corre la lógica sin sesión:** el servidor firma un JWT de corta vida (60 s) con el secreto JWT del proyecto, a nombre de la persona (`sub`, `role=authenticated`), y llama a `cargarSemaforos` con un cliente normal: las funciones que validan `auth.uid()` y la seguridad por finca se comportan exactamente como en la app. Un cliente de servicio a secas **no sirve**: esas funciones fallan sin `auth.uid()`. Para las funciones del bot se firma otro con `role=service_role`. Un solo secreto (`SUPABASE_JWT_SECRET`) en el entorno del servidor y de n8n; quien lo tenga puede hacerse pasar por cualquiera: nunca al repo ni al navegador.

## Datos (`20261030131339_notificaciones_telegram`)

| Tabla | Qué guarda | Quién la lee |
|---|---|---|
| `telegram_vinculos` | chat de cada persona por finca, estado (`pendiente`, `activo`, `pausado`, `bloqueado`), hash del código vigente | la persona ve lo suyo (sin `codigo_hash` ni `chat_id`: columnas sin permiso) |
| `notificacion_preferencias` | activo, resumen y su hora, días ISO 1–7, nivel mínimo (`rojo`/`ambar`), alertas, semanal, silencio, tope diario | la persona ve lo suyo; solo el superadministrador escribe |
| `notificacion_envios` | un registro por aviso (`tipo` + `clave`, única por persona): evita repetir y deja rastro; hasta 3 intentos | solo el servidor |

Funciones: `telegram_crear_codigo` y `telegram_desvincular` (la persona); `admin_notificaciones` y `admin_guardar_notificaciones` (superadministrador, validan `es_admin_plataforma`); `telegram_vincular`, `telegram_chat_estado`, `notificaciones_destinos`, `notificacion_reservar`, `notificacion_resultado` (**solo `service_role`**). `notificaciones_destinos(p_ahora)` calcula con la hora de Bogotá a quién le toca el resumen: activo, día elegido, ya pasó su hora (margen de 3 horas), sin envío de hoy; un fallo se reintenta hasta 3 veces. Límite conocido: un resumen programado después de las 21:00 no cuenta bien su margen (cruza la medianoche).

Probado con transacciones que se deshacen (propietario, ajeno, superadministrador, servidor): código, vinculación una sola vez, permisos, ventana horaria, envío único, reintento y bloqueo.

## Qué recibe cada rol (el alcance sale de `areasSemaforo`)

- **Propietario y administrador:** lo más urgente en rojo y ámbar, partos de la semana, compras por pagar y ventas por cobrar vencidas, novedades sin atender e inventario crítico (el administrador, además, las novedades «Comprar», el alimento y el mantenimiento de la sala).
- **Veterinario:** dosis y programas del día con sus animales, partos a vigilar, diagnósticos en ventana, FAMACHA y coprológico, retiros, pruebas, cuarentena, pezuñas, vacunas anuales, novedades «aplicar dosis» y medicamentos vencidos o en mínimo. Nada de dinero.
- **Ordeñador:** corto y llano: leche en retiro que se descarta hoy, hembras por secar, frío, mantenimiento de la sala, alimento que se acaba, producción que baja y su turno. Nada de dinero.
- **Contador:** compras por pagar y ventas por cobrar. Nada del hato.

Reglas contra el ruido: una alerta no se repite si no cambió, tope diario por persona, silencio nocturno (salvo un rojo crítico), hasta 5 aretes más «y N más» con enlace al punto exacto, y el nombre de la finca cuando la persona está en varias.

## Pendiente

1. Servidor del bot: webhook con firma (`X-Telegram-Bot-Api-Secret-Token`), `/start CODIGO`, `/hoy`, `/pausar`, `/reanudar`; ruta que arma los mensajes y registra los resultados.
2. «Conectar Telegram» en la app y pantalla del superadministrador para los parámetros.
3. Workflow de n8n (carpeta apriscol) con el Schedule de 15 minutos.
4. Alertas con dedupe, recordatorios con hora y resumen semanal.
5. Validar con el veterinario qué es «lo que hay que hacer hoy» para cada rol.
