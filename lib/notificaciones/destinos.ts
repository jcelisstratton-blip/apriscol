import { ETIQUETA_AREA } from "@/lib/semaforos";

/**
 * A dónde puede llevar un botón de Mini App. Lo que llega del navegador nunca se usa tal cual: o es una clave de la lista (los botones de mensajes anteriores) o es una
 * ruta INTERNA que pasa esta revisión. Aquí nada importa de más: solo reglas, para que `mensajes.ts` y `miniapp.ts` compartan la misma.
 */

/** Claves de los botones que ya están en chats de antes: se siguen aceptando y llevan a lo mismo que ahora. */
export const DESTINOS_CLAVE: Record<string, string> = {
  hoy: "/",
  semaforos: "/semaforos",
  ...Object.fromEntries(Object.keys(ETIQUETA_AREA).map((area) => [area, `/semaforos?area=${area}`])),
};

const MAX_RUTA = 300;
/** Ruta interna: letras, números, «-», «_», «/»; con consulta (`?a=b&c=d`) y ancla (`#algo`) opcionales. Sin «.», «%», «:» ni «\»: no hay forma de salir del sitio ni de subir carpetas. */
const RUTA_INTERNA = /^\/[A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&.]*)?(#[A-Za-z0-9\-_]*)?$/;
/** Cosas que un botón del bot nunca necesita abrir. */
const PROHIBIDAS = /^\/(api|telegram|auth|login|registro|recuperar|admin|cambiar-clave)(\/|\?|#|$)/;

/** La misma ruta si es interna y segura; si no, null. */
export function rutaInternaSegura(ruta: string): string | null {
  if (typeof ruta !== "string" || ruta.length === 0 || ruta.length > MAX_RUTA) return null;
  if (ruta.startsWith("//") || !RUTA_INTERNA.test(ruta) || PROHIBIDAS.test(ruta)) return null;
  return ruta;
}

/** La ruta a la que lleva un destino pedido (clave antigua o ruta interna), o null si no se puede. */
export function rutaDeDestino(destino: string): string | null {
  if (typeof destino !== "string") return null;
  if (Object.hasOwn(DESTINOS_CLAVE, destino)) return DESTINOS_CLAVE[destino];
  return rutaInternaSegura(destino);
}
