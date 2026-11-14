/**
 * Conexión de Claude por OAuth (sin pasar códigos a mano): Apriscol delega el inicio de sesión y los permisos en el servidor OAuth 2.1 de Supabase Auth.
 * Aquí solo vive lo que Claude necesita para descubrirlo (RFC 9728) y la respuesta 401 que lo dispara. La pantalla de permiso está en `/oauth/consent`.
 */
import { rutaMcp } from "@/lib/mcp/conexion";

/** El servidor de autorización: el Auth del proyecto de Supabase. */
export const servidorAutorizacion = (supabaseUrl: string) => `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;

/** Dónde Claude lee quién autoriza el acceso a `/api/mcp`. */
export const urlMetadatosRecurso = (sitio: string) => `${sitio.replace(/\/$/, "")}/.well-known/oauth-protected-resource/api/mcp`;

export function metadatosRecurso(sitio: string, supabaseUrl: string) {
  return {
    resource: rutaMcp(sitio),
    authorization_servers: [servidorAutorizacion(supabaseUrl)],
    bearer_methods_supported: ["header"],
    resource_name: "Apriscol",
  };
}

/** La cabecera de un 401: dice cómo conseguir permiso. Con `resource_metadata`, Claude abre solo el inicio de sesión. */
export const cabeceraNoAutorizado = (sitio: string) => `Bearer realm="apriscol", resource_metadata="${urlMetadatosRecurso(sitio)}"`;

/** Respuesta de los documentos de descubrimiento: públicos, sin sesión, con CORS abierto (no llevan nada privado). */
export function respuestaMetadatos(sitio: string, supabaseUrl: string): Response {
  return Response.json(metadatosRecurso(sitio, supabaseUrl), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
