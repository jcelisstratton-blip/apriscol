# Conexión con IA (MCP)

Apriscol expone un servidor **MCP** (Model Context Protocol) de **solo lectura** en `POST /api/mcp`: el asistente de una persona (Claude Desktop, Claude Code, Cursor…) consulta
su finca en lenguaje natural («¿qué cabras tienen retiro esta semana?», «¿cómo va la leche este mes?»). Ningún asistente puede escribir, borrar ni cambiar nada.

## Cómo se identifica quien consulta

- **Token personal** (`apr_` + 43 caracteres, 256 bits al azar), creado por la persona en Mi finca → Conexión con IA y mostrado **una sola vez**. En la base solo vive su
  **huella SHA-256** (`tokens_ia.huella`): ni una filtración de la base ni un administrador pueden recuperarlo. Cada token es de **una persona en una finca**
  (llave compuesta a `finca_miembros`: si la sacan de la finca, sus tokens desaparecen) y se puede revocar.
- Tope de **5 tokens activos** por persona y finca (disparador `tokens_ia_tope`). La persona ve y revoca solo los suyos (RLS); solo puede cambiar `revocado_en`.
- `/api/mcp` no lleva sesión de navegador (está en `PUBLICAS` de `lib/supabase/proxy.ts`): manda el token, `Authorization: Bearer apr_…`. La finca y el rol **salen del token y de
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
- **Sin OAuth todavía:** el token sirve para Claude Desktop, Claude Code y Cursor. Claude.ai web/celular exige OAuth; es una entrega aparte.
- Nada del libro genealógico ni de documentos de titulares.
