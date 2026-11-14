# Conexión con IA (MCP)

Apriscol expone un servidor **MCP** (Model Context Protocol) de **solo lectura** en `POST /api/mcp`: el asistente de una persona (Claude Desktop, Claude Code, Cursor…) consulta
su finca en lenguaje natural («¿qué cabras tienen retiro esta semana?», «¿cómo va la leche este mes?»). Ningún asistente puede escribir, borrar ni cambiar nada.

## Cómo se conecta (la vía fácil: OAuth)

El ganadero no copia códigos ni edita archivos: en Claude (escritorio, web o celular) va a Configuración → Conectores → **Agregar conector personalizado**, pega `https://apriscol.shop/api/mcp`, toca Conectar,
entra con su cuenta de Apriscol y toca **Permitir**. Por debajo:

1. Claude llama a `/api/mcp` sin credencial → **401** con `WWW-Authenticate: Bearer … resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"` (`lib/mcp/oauth.ts`).
2. Ese documento (públicos, `app/.well-known/…`, RFC 9728) dice que quien autoriza es el **servidor OAuth 2.1 de Supabase Auth** (`<proyecto>/auth/v1`); Claude se registra solo (registro dinámico) y manda a la persona a entrar.
3. Supabase redirige a **`/oauth/consent?authorization_id=…`** (`app/oauth/consent`): pantalla de permiso con qué podrá y qué nunca podrá hacer (`lib/mcp/consentimiento.ts`); quien no ha entrado pasa antes por `/login` y vuelve. `getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization`.
4. Claude recibe un JWT de Supabase (con `client_id`) y lo manda en cada consulta. `/api/mcp` lo valida con `getClaims` (llaves públicas), **exige `client_id`** (una sesión normal de la web no sirve) y consulta con ese mismo JWT: la persona, su rol y la RLS de siempre, **sin llave de servicio**. La finca es la **activa** de la persona en la app.

**Requisito en Supabase (una vez, en el panel):** Authentication → OAuth Server → activar, ruta de autorización `/oauth/consent`, y **permitir el registro dinámico de clientes** (sin eso Claude no puede registrarse). El servidor OAuth de Supabase está en beta.
La pantalla Mi finca → Conexión con IA (`components/ConectarClaude.tsx`) muestra arriba **«Claude está conectado»** con la fecha del permiso y «Quitar permiso» (`listGrants` / `revokeGrant`: quitar un permiso cierra sus sesiones y anula la renovación); sin permiso, muestra los tres pasos y la dirección. «Conectar otro Claude» vuelve a mostrar los pasos.

## Token personal (opción avanzada)

Para Claude Code y clientes sin OAuth, Mi finca → Conexión con IA → «Opciones avanzadas» (cerrado por defecto, una línea de explicación, sin repetir la introducción: `incrustada`) (`components/ConexionIa.tsx`): crea una conexión con un nombre; el código se **muestra una sola vez** (acción `crearConexionIa`, con RLS)
junto con lo que hay que pegar en Claude Code, Claude Desktop (puente `mcp-remote`) y Cursor (`lib/mcp/conexion.ts`). La lista muestra solo las propias y **nunca trae la huella**; revocar corta el acceso al instante.

## Detalle del token personal

- **Token personal** (`apr_` + 43 caracteres, 256 bits al azar), creado por la persona en Mi finca → Conexión con IA y mostrado **una sola vez**. En la base solo vive su
  **huella SHA-256** (`tokens_ia.huella`): ni una filtración de la base ni un administrador pueden recuperarlo. Cada token es de **una persona en una finca**
  (llave compuesta a `finca_miembros`: si la sacan de la finca, sus tokens desaparecen) y se puede revocar.
- Tope de **5 tokens activos** por persona y finca (disparador `tokens_ia_tope`). La persona ve y revoca solo los suyos (RLS); solo puede cambiar `revocado_en`.
- `/api/mcp` y `/.well-known` no llevan sesión de navegador (están en `PUBLICAS` de `lib/supabase/proxy.ts`): manda el token, `Authorization: Bearer apr_…`. La finca y el rol **salen del token y de
  `finca_miembros` en cada consulta** — el asistente nunca elige la finca ni el rol, y un cambio de rol aplica de inmediato.
- Si el plan de la finca está bloqueado o pendiente (`estado_vigencia_finca`), el token responde 403.

## Cómo corren las consultas

Cada herramienta se ejecuta **como la persona** (`conSesionDe` de `lib/notificaciones/servidor.ts`: sesión emitida por Supabase y cerrada al terminar), no con la llave de servicio:
rige la misma RLS que en la app. La llave de servicio solo se usa para buscar el token por su huella y leer rol/plan de la finca. Los errores internos nunca llegan tal cual al
asistente (quedan como `[apriscol:mcp]` en los registros de Vercel); los textos devueltos son datos de la finca, nunca instrucciones.

## Herramientas (`lib/mcp/herramientas.ts`)

| Herramienta | Qué da | Quién la recibe |
|---|---|---|
| `resumen_de_hoy` | Conteo de señales (rojo / ámbar / en orden) y las pendientes con sus primeros casos | quien tenga áreas de semáforo (todos los roles hoy) |
| `semaforos` | Señales con casos, qué significan y qué hacer; filtro por área y nivel | igual, **acotado a las áreas de su rol** (`areasSemaforo`) |
| `buscar_animal` | Hasta 10 animales por nombre o arete (tipo, estado, nacimiento) | quien pueda ver Hato |
| `produccion_de_leche` | Litros a tanque de 7/30/90/365 días, promedio, mejor día, descartes y cambio frente al periodo anterior | quien pueda ver Leche |

Las reglas no se duplican: los semáforos salen de `cargarSemaforos` y la leche de `produccion_historial` + `calcularTotales`, las mismas de la app. Una herramienta nueva se agrega solo en
`herramientasPara`, con su prueba en `tests/mcp.test.mjs`, y entra aquí.

## Protocolo y límites

`lib/mcp/protocolo.ts` implementa MCP sin dependencias (JSON-RPC 2.0, sin estado, respuesta JSON): `initialize`, `ping`, `tools/list`, `tools/call`. Todas las herramientas declaran
`readOnlyHint`. Mensaje máximo 64 KB; tope de **120 consultas por hora por token** (`lib/mcp/limite.ts`, en memoria por instancia) con 429; lote máximo de 10 mensajes.

## Lo que NO hace (decisiones)

- **Sin herramientas de escritura.** Si algún día se agregan, dejan un borrador que la persona confirma (como Stratt), nunca actúan solas.
- Nada del libro genealógico ni de documentos de titulares.
