import { createHmac, timingSafeEqual } from "node:crypto";
import { RUTA_AREA } from "@/lib/notificaciones/mensajes";

/**
 * «Abrir en la app» sin el aviso de dirección de Telegram: el botón abre Apriscol dentro de Telegram (una Mini App) y Telegram entrega, firmado con el token del
 * bot, quién lo tocó (`initData`). Aquí se comprueba esa firma; solo después se abre la sesión de esa persona. Nada de esto se puede falsificar sin el token.
 */

/** Cuánto vale una firma desde que Telegram la emite: cada toque al botón trae una nueva, así que se acepta poco tiempo. */
export const MAX_EDAD_FIRMA_SEG = 600;
/** Margen para relojes un poco adelantados. */
const MARGEN_FUTURO_SEG = 60;

/** A dónde puede llevar el botón: solo estas pantallas, por clave. Nunca una dirección que venga del navegador. */
export const DESTINOS_MINIAPP: Record<string, string> = { hoy: "/", semaforos: "/semaforos", ...RUTA_AREA };

/** La ruta de una clave de destino, o null si no es una de las permitidas. */
export const rutaDeDestino = (clave: string): string | null => (Object.hasOwn(DESTINOS_MINIAPP, clave) ? DESTINOS_MINIAPP[clave] : null);

export type VerificacionMiniApp = { ok: true; userId: number; authDate: number } | { ok: false; motivo: "formato" | "firma" | "vencido" | "usuario" };

const hmac = (clave: string | Buffer, datos: string) => createHmac("sha256", clave).update(datos).digest();

function mismaFirma(esperada: Buffer, recibida: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(recibida)) return false;
  return timingSafeEqual(esperada, Buffer.from(recibida, "hex"));
}

/**
 * Comprueba la firma de `initData` (la cadena de parámetros que Telegram pasa a la Mini App) con el token del bot, que no sea vieja y que traiga a la persona.
 * La firma cubre todos los campos menos `hash`; por si una versión de Telegram deja fuera también `signature`, se acepta cualquiera de las dos formas: ambas
 * exigen el token, así que ninguna se puede fabricar.
 */
export function verificarInitData(initData: string, botToken: string, ahoraSeg: number = Math.floor(Date.now() / 1000), maxEdadSeg: number = MAX_EDAD_FIRMA_SEG): VerificacionMiniApp {
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 4096 || !botToken) return { ok: false, motivo: "formato" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, motivo: "formato" };
  const cadena = (excluir: string[]) =>
    [...params.entries()]
      .filter(([k]) => !excluir.includes(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
  const llave = hmac("WebAppData", botToken);
  const valida = mismaFirma(hmac(llave, cadena(["hash"])), hash) || mismaFirma(hmac(llave, cadena(["hash", "signature"])), hash);
  if (!valida) return { ok: false, motivo: "firma" };

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || authDate <= 0) return { ok: false, motivo: "formato" };
  if (ahoraSeg - authDate > maxEdadSeg || authDate - ahoraSeg > MARGEN_FUTURO_SEG) return { ok: false, motivo: "vencido" };

  let id: unknown;
  try {
    id = (JSON.parse(params.get("user") ?? "null") as { id?: unknown } | null)?.id;
  } catch {
    return { ok: false, motivo: "usuario" };
  }
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return { ok: false, motivo: "usuario" };
  return { ok: true, userId: id, authDate };
}
