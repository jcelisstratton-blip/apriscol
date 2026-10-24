const TIPO_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** El nombre sin tildes ni caracteres raros, para la cabecera clásica de descarga (los navegadores nuevos usan el nombre completo). */
export const nombreAscii = (nombre: string): string => nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

/** Las cabeceras de la descarga de un Excel: con el nombre completo (con tildes) y uno de respaldo, y sin guardar nada en caché. */
export function cabecerasExcel(nombre: string): Record<string, string> {
  return {
    "Content-Type": TIPO_EXCEL,
    "Content-Disposition": `attachment; filename="${nombreAscii(nombre)}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    "Cache-Control": "no-store",
  };
}

/** La respuesta de una descarga de Excel ya armado en memoria. */
export const respuestaExcel = (libro: Uint8Array, nombre: string) => new Response(new Uint8Array(libro), { headers: cabecerasExcel(nombre) });
