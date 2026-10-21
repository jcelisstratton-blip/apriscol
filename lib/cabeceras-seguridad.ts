/**
 * Cabeceras de seguridad de todas las respuestas (se aplican desde `next.config.ts`).
 *
 * Siempre activas (no cambian nada visible): `nosniff`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy`.
 * La política de contenido (CSP) va en modo **solo reportar** (`CSP_ENFORZAR = false`): el navegador no bloquea nada y cada
 * violación llega a `/api/csp`, que la deja en los registros de Vercel con la marca `[apriscol:csp]`. Cuando pasen unos días de
 * uso real sin violaciones, se cambia a `true` y se bloquea de verdad.
 */
export const CSP_ENFORZAR = false;

/** Dirección a la que el navegador manda los reportes de la política. */
export const RUTA_REPORTE_CSP = "/api/csp";

export type Cabecera = { key: string; value: string };

/** El origen (`https://xyz.supabase.co`) de la dirección del proyecto de Supabase, o null si no es una dirección válida. */
export function origenDe(direccion: string): string | null {
  try {
    const u = new URL(direccion);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** La política de contenido: solo lo propio, más lo que la app usa de verdad (Supabase para datos y fotos, `blob:`/`data:` para la vista previa de una foto). */
export function politicaDeContenido(supabaseUrl: string): string {
  const supabase = origenDe(supabaseUrl);
  const ws = supabase ? supabase.replace(/^http/, "ws") : null;
  const directivas = [
    "default-src 'self'",
    // Next incrusta scripts y estilos en línea en cada página; sin nonces por petición hace falta 'unsafe-inline'.
    // Aun así queda bloqueado todo script, estilo o imagen que venga de otro sitio que no sea el propio.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}${ws ? ` ${ws}` : ""}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // El navegador ignora esta directiva (y avisa en la consola) cuando la política solo reporta.
    ...(CSP_ENFORZAR ? ["upgrade-insecure-requests"] : []),
    `report-uri ${RUTA_REPORTE_CSP}`,
  ];
  return directivas.join("; ");
}

/** Las cabeceras de toda la aplicación. En desarrollo no se manda la política (Next usa `eval` y scripts que ella bloquearía). */
export function cabecerasDeSeguridad(supabaseUrl: string, produccion: boolean): Cabecera[] {
  const cabeceras: Cabecera[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ];
  if (produccion) {
    cabeceras.push({
      key: CSP_ENFORZAR ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: politicaDeContenido(supabaseUrl),
    });
  }
  return cabeceras;
}

/**
 * Convierte el reporte de una violación (formato `application/csp-report`) en una línea JSON para los registros.
 * Solo lleva lo que ayuda a ubicar el problema: nunca la dirección completa (puede traer un token en la ruta ni parámetros).
 */
export function lineaDeViolacionCsp(cuerpo: unknown): string | null {
  const r = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>)["csp-report"] : null;
  if (typeof r !== "object" || r === null) return null;
  const c = r as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  // Sin parámetros ni fragmento; los tramos largos de una ruta (tokens, ids) se reemplazan.
  const limpiar = (v: unknown) => {
    const t = texto(v);
    if (!t || !/^[a-z]+:\/\//i.test(t)) return t.slice(0, 40); // «inline», «eval», «data», «blob»…
    try {
      const u = new URL(t);
      return (u.origin + u.pathname.replace(/\/[^/]{20,}/g, "/:id")).slice(0, 200);
    } catch {
      return "?";
    }
  };
  return JSON.stringify({
    marca: "[apriscol:csp]",
    directiva: texto(c["effective-directive"] || c["violated-directive"]).slice(0, 60),
    bloqueado: limpiar(c["blocked-uri"]),
    pagina: limpiar(c["document-uri"]),
    origen: limpiar(c["source-file"]),
    modo: texto(c["disposition"]).slice(0, 10) || null,
  });
}
