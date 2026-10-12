/** Documentos de respaldo (resultados de laboratorio, actas): formatos aceptados y rutas. Viven en el bucket privado «soportes». */
export const CARPETAS_SOPORTE = ["calidad", "carne", "sanidad"] as const;
export type CarpetaSoporte = (typeof CARPETAS_SOPORTE)[number];

export const TIPOS_SOPORTE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const TAMANO_MAXIMO_SOPORTE = 10 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** ¿Es una ruta de documento válida de esta finca y de esta carpeta? (El navegador nunca elige la ruta: la arma el servidor.) */
export const soporteValido = (ruta: string | null | undefined, fincaId: string, carpeta: CarpetaSoporte) =>
  !ruta || new RegExp(`^${fincaId}/${carpeta}/${UUID}\\.(pdf|jpg|png|webp)$`).test(ruta);

/** Dirección que abre un documento: comprueba el permiso y redirige a un enlace temporal. */
export const direccionSoporte = (ruta: string) => `/soporte?ruta=${encodeURIComponent(ruta)}`;

export const ES_RUTA_SOPORTE = new RegExp(`^${UUID}/(calidad|carne|sanidad)/${UUID}\\.(pdf|jpg|png|webp)$`);
