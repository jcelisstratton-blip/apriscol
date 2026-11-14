import { atenderMensaje } from "@/lib/mcp/protocolo";
import { herramientasPara } from "@/lib/mcp/herramientas";
import { crearLimitador } from "@/lib/mcp/limite";
import { autenticar, datosDe } from "@/lib/mcp/servidor";
import { tokenDeCabecera } from "@/lib/mcp/token";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const limitador = crearLimitador();
const MAX_BYTES = 64 * 1024;
const NO_ES_JSON = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "El cuerpo no es JSON." } };

const sinAcceso = (estado: number, motivo: string) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: motivo } }, { status: estado, headers: estado === 401 ? { "WWW-Authenticate": 'Bearer realm="apriscol"' } : undefined });

/**
 * MCP de Apriscol (solo lectura): el asistente de una persona (Claude Desktop, Claude Code…) consulta su finca con un token personal
 * (`Authorization: Bearer apr_…`, creado en Mi finca → Conexión con IA). Sin sesión de navegador: el token manda. Las consultas corren como esa
 * persona (su rol y la seguridad por finca), nunca con la llave de servicio, y la finca sale del token, nunca de lo que mande el asistente.
 */
export async function POST(req: Request) {
  const token = tokenDeCabecera(req.headers.get("authorization"));
  if (!token) return sinAcceso(401, "Falta el token de Apriscol o no tiene el formato correcto (Authorization: Bearer apr_…).");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Mensaje demasiado grande." } }, { status: 413 });

  const entrada = await req.json().catch(() => null);
  if (entrada === null) return Response.json(NO_ES_JSON, { status: 400 });

  const r = await autenticar(token);
  if (!r.ok) return sinAcceso(r.estado, r.motivo);
  if (!limitador.permitir(r.auth.tokenId)) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32002, message: "Demasiadas consultas. Espera un momento." } }, { status: 429, headers: { "Retry-After": "60" } });

  const herramientas = herramientasPara(r.auth.ctx, datosDe(r.auth));
  const mensajes = Array.isArray(entrada) ? entrada : [entrada];
  if (mensajes.length === 0 || mensajes.length > 10) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Solicitud inválida." } }, { status: 400 });
  const respuestas = (await Promise.all(mensajes.map((m) => atenderMensaje(m, herramientas)))).filter((x) => x !== null);
  if (respuestas.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(entrada) ? respuestas : respuestas[0]);
}

const noPermitido = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = noPermitido;
export const DELETE = noPermitido;
