/** Logo opcional de la finca: dónde vive y cómo se muestra. La ruta es siempre `<finca_id>/<uuid>.<jpg|png|webp>` (la base también lo exige). */
export const BUCKET_LOGOS = "logos-fincas" as const;

/** Formatos aceptados → extensión. Nunca SVG: puede llevar código. */
export const TIPOS_LOGO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿La ruta es un logo de ESTA finca? (carpeta de la finca, nombre uuid, extensión permitida). */
export function rutaLogoValida(ruta: string, fincaId: string): boolean {
  if (!ID_UUID.test(fincaId)) return false;
  const [carpeta, archivo, ...resto] = ruta.split("/");
  if (resto.length > 0 || carpeta !== fincaId) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(archivo ?? "");
}

/**
 * Dirección con la que el navegador pide el logo (`/api/logo`, solo con sesión). Lleva el nombre del archivo como versión: cada logo nuevo
 * tiene otro nombre, así que el navegador puede guardar el anterior para siempre sin que se quede con uno viejo.
 */
export function urlLogo(finca: { id: string; logo_path: string | null }): string | null {
  const archivo = finca.logo_path?.split("/")[1];
  return archivo ? `/api/logo?f=${finca.id}&v=${archivo}` : null;
}
