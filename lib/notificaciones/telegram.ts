import { timingSafeEqual } from "node:crypto";

/** Telegram corta un mensaje a 4096 caracteres. */
export const LIMITE_MENSAJE = 4096;

export const escaparHtml = (texto: string): string => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Comparación del secreto sin filtrar su largo ni su contenido por el tiempo que tarda. */
export function secretoValido(recibido: string | null | undefined, esperado: string | undefined): boolean {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Comando = { comando: "start" | "hoy" | "pausar" | "reanudar" | "ayuda" | "desconocido" | null; argumento: string };

/** «/start@apriscolbot AB12CD34» → { comando: "start", argumento: "AB12CD34" }. Un texto que no empieza por «/» no es un comando. */
export function interpretarComando(texto: string | undefined): Comando {
  const limpio = (texto ?? "").trim();
  if (!limpio.startsWith("/")) return { comando: null, argumento: limpio };
  const [primera, ...resto] = limpio.split(/\s+/);
  const nombre = primera.slice(1).split("@")[0].toLowerCase();
  const argumento = resto.join(" ").trim();
  switch (nombre) {
    case "start":
    case "hoy":
    case "pausar":
    case "reanudar":
    case "ayuda":
      return { comando: nombre, argumento };
    case "help":
      return { comando: "ayuda", argumento };
    default:
      return { comando: "desconocido", argumento };
  }
}

export type EventoTelegram =
  | { tipo: "mensaje"; chatId: number; privado: boolean; texto: string }
  | { tipo: "bloqueo"; chatId: number }
  | { tipo: "otro" };

type UpdateTelegram = {
  message?: { text?: string; chat?: { id?: number; type?: string } };
  my_chat_member?: { chat?: { id?: number; type?: string }; new_chat_member?: { status?: string } };
};

/** Lo que importa de lo que manda Telegram al webhook. Lo demás se ignora. */
export function leerEvento(cuerpo: unknown): EventoTelegram {
  const u = (cuerpo ?? {}) as UpdateTelegram;
  const mensaje = u.message;
  if (mensaje && typeof mensaje.chat?.id === "number") {
    return { tipo: "mensaje", chatId: mensaje.chat.id, privado: mensaje.chat.type === "private", texto: typeof mensaje.text === "string" ? mensaje.text : "" };
  }
  const cambio = u.my_chat_member;
  if (cambio && typeof cambio.chat?.id === "number" && cambio.chat.type === "private" && cambio.new_chat_member?.status === "kicked") {
    return { tipo: "bloqueo", chatId: cambio.chat.id };
  }
  return { tipo: "otro" };
}

export type ResultadoEnvio = { ok: true; messageId: number } | { ok: false; error: string; bloqueado: boolean };

/** Envía un mensaje (HTML). Un 403 quiere decir que la persona bloqueó el bot o borró el chat: no se vuelve a intentar. */
export async function enviarTelegram(token: string, chatId: number, texto: string, http: typeof fetch = fetch): Promise<ResultadoEnvio> {
  try {
    const r = await http(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, LIMITE_MENSAJE), parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
    });
    const datos = (await r.json().catch(() => null)) as { ok?: boolean; description?: string; result?: { message_id?: number } } | null;
    if (r.ok && datos?.ok && typeof datos.result?.message_id === "number") return { ok: true, messageId: datos.result.message_id };
    return { ok: false, error: (datos?.description ?? `Telegram respondió ${r.status}`).slice(0, 300), bloqueado: r.status === 403 };
  } catch (e) {
    // El mensaje de un fallo de red no lleva el token (la dirección no se incluye), pero se recorta por si acaso.
    return { ok: false, error: (e instanceof Error ? e.message : "No se pudo conectar con Telegram").replaceAll(token, "***").slice(0, 300), bloqueado: false };
  }
}
