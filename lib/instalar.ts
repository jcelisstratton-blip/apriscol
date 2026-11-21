/**
 * Instalar Apriscol en la pantalla de inicio. Instalada, el celular la abre como app (también sin señal, de un toque) y no borra lo
 * guardado sin señal: Safari en iPhone borra los datos de una página que no se abre en unos días si no está en la pantalla de inicio, y Android
 * se los guarda a una app instalada aunque falte espacio. Por eso el aviso insiste más en iPhone. Reglas puras (sin navegador): las prueba
 * `tests/instalar.test.mjs`; lo que lee el navegador vive en `lib/instalar-navegador.ts`.
 */
export type Plataforma = "ios" | "android" | "otro";

/** Clave de `localStorage` con la fecha en que la persona tocó «Ahora no». */
export const CLAVE_INSTALAR_OCULTO = "apriscol:instalar-oculto";
/** Tras «Ahora no» el aviso vuelve a salir pasados estos días (lo guardado se sigue arriesgando mientras no se instale). */
export const DIAS_OCULTAR_INSTALAR = 14;
/** La pantalla fija con los pasos (Mi finca → Instalar la app). */
export const RUTA_INSTALAR = "/mas/instalar";

/**
 * El sistema del aparato. Un iPad con iPadOS se presenta como Mac, pero tiene pantalla táctil. Un celular que pide el «sitio de escritorio»
 * (Chrome lo hace solo en pantallas grandes y plegables) se presenta como computador: si la pantalla es táctil y el puntero es el dedo
 * (`tactil`), se trata como celular y se dan los pasos del menú del navegador, que son los mismos de Android.
 */
export function plataformaDe(agente: string, puntosToque: number, tactil = false): Plataforma {
  if (/iPhone|iPad|iPod/i.test(agente) || (/Macintosh/i.test(agente) && puntosToque > 1)) return "ios";
  if (/Android/i.test(agente)) return "android";
  if (tactil && puntosToque > 0) return "android";
  return "otro";
}

/** Abierta dentro de otra app (WhatsApp, Instagram, Facebook, Gmail…): desde ahí no se puede instalar, hay que abrirla en el navegador. */
export function dentroDeApp(agente: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|GSA\/|; wv\)|Snapchat|TikTok|musical_ly/i.test(agente);
}

/** El navegador, para decir los pasos que le tocan («Safari», «Chrome»…). */
export function navegadorDe(agente: string): string {
  if (dentroDeApp(agente)) return "el navegador de otra app";
  if (/EdgA?\/|Edg\//i.test(agente)) return "Edge";
  if (/SamsungBrowser/i.test(agente)) return "Samsung Internet";
  if (/FxiOS|Firefox/i.test(agente)) return "Firefox";
  if (/CriOS|Chrome|Chromium/i.test(agente)) return "Chrome";
  if (/Safari/i.test(agente)) return "Safari";
  return "tu navegador";
}

/** En iPhone solo se instala desde Safari (o Chrome y Edge recientes, por Compartir); Firefox y las apps no siempre lo ofrecen. */
export function iosPuedeInstalar(agente: string): boolean {
  return !dentroDeApp(agente) && !/FxiOS/i.test(agente);
}

export function avisoInstalarVisible(p: { instalada: boolean; plataforma: Plataforma; ocultoEn: string | null; ahora: Date }): boolean {
  if (p.instalada || p.plataforma === "otro") return false;
  if (!p.ocultoEn) return true;
  const desde = Date.parse(p.ocultoEn);
  return Number.isNaN(desde) || p.ahora.getTime() - desde >= DIAS_OCULTAR_INSTALAR * 86_400_000;
}
