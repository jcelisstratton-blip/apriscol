import "server-only";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/env";

/**
 * Dirección pública desde la que se está usando la app (producción, preview o dominio propio).
 * Se toma de la petición para que los enlaces de correo e invitaciones funcionen en cualquier entorno;
 * NEXT_PUBLIC_SITE_URL queda solo como respaldo.
 */
export async function urlDelSitio(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
