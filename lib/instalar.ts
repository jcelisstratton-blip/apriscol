/**
 * Aviso para instalar Apriscol en la pantalla de inicio. Instalada, el celular la abre como app (también sin señal, de un toque) y no borra lo
 * guardado sin señal: Safari en iPhone borra los datos de una página que no se abre en unos días si no está en la pantalla de inicio, y Android
 * se los guarda a una app instalada aunque falte espacio. Por eso el aviso insiste más en iPhone.
 */
export type Plataforma = "ios" | "android" | "otro";

/** Clave de `localStorage` con la fecha en que la persona tocó «Ahora no». */
export const CLAVE_INSTALAR_OCULTO = "apriscol:instalar-oculto";
/** Tras «Ahora no» el aviso vuelve a salir pasados estos días (lo guardado se sigue arriesgando mientras no se instale). */
export const DIAS_OCULTAR_INSTALAR = 14;

/** El celular por su navegador: un iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil. En el computador no se muestra el aviso. */
export function plataformaDe(agente: string, puntosToque: number): Plataforma {
  if (/iPhone|iPad|iPod/i.test(agente) || (/Macintosh/i.test(agente) && puntosToque > 1)) return "ios";
  if (/Android/i.test(agente)) return "android";
  return "otro";
}

export function avisoInstalarVisible(p: { instalada: boolean; plataforma: Plataforma; ocultoEn: string | null; ahora: Date }): boolean {
  if (p.instalada || p.plataforma === "otro") return false;
  if (!p.ocultoEn) return true;
  const desde = Date.parse(p.ocultoEn);
  return Number.isNaN(desde) || p.ahora.getTime() - desde >= DIAS_OCULTAR_INSTALAR * 86_400_000;
}
