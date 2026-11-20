const TIPO_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** El nombre sin tildes ni caracteres raros, para la cabecera clásica de descarga (los navegadores nuevos usan el nombre completo). */
export const nombreAscii = (nombre: string): string => nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

/** Las cabeceras de una descarga: con el nombre completo (con tildes) y uno de respaldo, y sin guardar nada en caché. */
function cabecerasDescarga(tipo: string, nombre: string): Record<string, string> {
  return {
    "Content-Type": tipo,
    "Content-Disposition": `attachment; filename="${nombreAscii(nombre)}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    "Cache-Control": "no-store",
  };
}

/** Las cabeceras de la descarga de un Excel. */
export const cabecerasExcel = (nombre: string): Record<string, string> => cabecerasDescarga(TIPO_EXCEL, nombre);

/** Las cabeceras de la descarga de un .zip (varios archivos en uno). */
export const cabecerasZip = (nombre: string): Record<string, string> => cabecerasDescarga("application/zip", nombre);

/** La respuesta de una descarga de Excel ya armado en memoria. */
export const respuestaExcel = (libro: Uint8Array, nombre: string) => new Response(new Uint8Array(libro), { headers: cabecerasExcel(nombre) });

/** La respuesta de una descarga de un .zip ya armado en memoria. */
export const respuestaZip = (zip: Uint8Array, nombre: string) => new Response(new Uint8Array(zip), { headers: cabecerasZip(nombre) });
