import { SITE_URL, SUPABASE_URL } from "@/lib/env";
import { respuestaMetadatos } from "@/lib/mcp/oauth";

export const dynamic = "force-static";

/** Descubrimiento OAuth del recurso protegido (RFC 9728): quién autoriza el acceso del asistente a `/api/mcp`. Sin sesión: lo lee Claude antes de conectar. */
export const GET = () => respuestaMetadatos(SITE_URL, SUPABASE_URL);
