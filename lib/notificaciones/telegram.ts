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
  /** La persona tocó un botón del mensaje: `datos` es lo que se le puso al botón. */
  | { tipo: "accion"; id: string; chatId: number; messageId: number; datos: string }
  | { tipo: "otro" };

type UpdateTelegram = {
  message?: { text?: string; chat?: { id?: number; type?: string } };
  my_chat_member?: { chat?: { id?: number; type?: string }; new_chat_member?: { status?: string } };
  callback_query?: { id?: string; data?: string; message?: { message_id?: number; chat?: { id?: number; type?: string } } };
};

/** Lo que importa de lo que manda Telegram al webhook. Lo demás se ignora. */
export function leerEvento(cuerpo: unknown): EventoTelegram {
  const u = (cuerpo ?? {}) as UpdateTelegram;
  const mensaje = u.message;
  if (mensaje && typeof mensaje.chat?.id === "number") {
    return { tipo: "mensaje", chatId: mensaje.chat.id, privado: mensaje.chat.type === "private", texto: typeof mensaje.text === "string" ? mensaje.text : "" };
  }
  const boton = u.callback_query;
  if (boton && typeof boton.id === "string" && typeof boton.data === "string" && typeof boton.message?.message_id === "number" && typeof boton.message.chat?.id === "number" && boton.message.chat.type === "private") {
    return { tipo: "accion", id: boton.id, chatId: boton.message.chat.id, messageId: boton.message.message_id, datos: boton.data.slice(0, 64) };
  }
  const cambio = u.my_chat_member;
  if (cambio && typeof cambio.chat?.id === "number" && cambio.chat.type === "private" && cambio.new_chat_member?.status === "kicked") {
    return { tipo: "bloqueo", chatId: cambio.chat.id };
  }
  return { tipo: "otro" };
}

/**
 * Un botón del mensaje: abre una dirección (solo https), abre Apriscol dentro de Telegram sin el aviso de dirección (`miniApp`, solo https y solo en chat privado)
 * o le pide algo al bot (`accion`, hasta 64 caracteres).
 */
export type Boton = { texto: string } & ({ url: string } | { miniApp: string } | { accion: string });

export type ResultadoEnvio = { ok: true; messageId: number } | { ok: false; error: string; bloqueado: boolean };

type RespuestaTelegram = { ok?: boolean; description?: string; result?: { message_id?: number } };

const teclado = (botones: Boton[][]) => ({ inline_keyboard: botones.map((fila) => fila.map((b) => ("url" in b ? { text: b.texto, url: b.url } : "miniApp" in b ? { text: b.texto, web_app: { url: b.miniApp } } : { text: b.texto, callback_data: b.accion }))) });

/** Llama a un método de Telegram. Un fallo de red no lleva el token (la dirección no se incluye), pero se recorta por si acaso. */
async function llamar(token: string, metodo: string, cuerpo: object, http: typeof fetch): Promise<{ estado: number; datos: RespuestaTelegram | null } | { error: string }> {
  try {
    const r = await http(`https://api.telegram.org/bot${token}/${metodo}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    return { estado: r.status, datos: (await r.json().catch(() => null)) as RespuestaTelegram | null };
  } catch (e) {
    return { error: (e instanceof Error ? e.message : "No se pudo conectar con Telegram").replaceAll(token, "***").slice(0, 300) };
  }
}

/**
 * Envía un mensaje (HTML), con botones debajo si se piden. Un 403 quiere decir que la persona bloqueó el bot o borró el chat: no se vuelve a intentar.
 * Si Telegram rechaza los botones (dirección no válida), se reenvía el mismo mensaje sin ellos: es mejor que llegue sin botones a que no llegue.
 */
export async function enviarTelegram(token: string, chatId: number, texto: string, botones: Boton[][] = [], http: typeof fetch = fetch): Promise<ResultadoEnvio> {
  const intentar = (conBotones: boolean) =>
    llamar(token, "sendMessage", { chat_id: chatId, text: texto.slice(0, LIMITE_MENSAJE), parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...(conBotones ? { reply_markup: teclado(botones) } : {}) }, http);
  let r = await intentar(botones.length > 0);
  if ("estado" in r && r.estado === 400 && botones.length > 0) r = await intentar(false);
  if ("error" in r) return { ok: false, error: r.error, bloqueado: false };
  if (r.estado === 200 && r.datos?.ok && typeof r.datos.result?.message_id === "number") return { ok: true, messageId: r.datos.result.message_id };
  return { ok: false, error: (r.datos?.description ?? `Telegram respondió ${r.estado}`).slice(0, 300), bloqueado: r.estado === 403 };
}

/** Cambia el texto y los botones de un mensaje ya enviado (así «ver el detalle» no llena el chat). Que no haya cambios no es un error. */
export async function editarTelegram(token: string, chatId: number, messageId: number, texto: string, botones: Boton[][] = [], http: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await llamar(token, "editMessageText", { chat_id: chatId, message_id: messageId, text: texto.slice(0, LIMITE_MENSAJE), parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: teclado(botones) }, http);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.estado === 200 && r.datos?.ok) return { ok: true };
  const motivo = (r.datos?.description ?? `Telegram respondió ${r.estado}`).slice(0, 300);
  return /message is not modified/i.test(motivo) ? { ok: true } : { ok: false, error: motivo };
}

/** Le quita el círculo de «cargando» al botón que se tocó (con un aviso corto opcional). Hay que llamarlo pronto: Telegram espera la respuesta unos segundos. */
export async function responderAccion(token: string, id: string, aviso?: string, http: typeof fetch = fetch): Promise<void> {
  await llamar(token, "answerCallbackQuery", { callback_query_id: id, ...(aviso ? { text: aviso.slice(0, 200) } : {}) }, http);
}
