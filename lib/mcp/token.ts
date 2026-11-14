import { createHash, randomBytes } from "node:crypto";

/**
 * El token personal de la «Conexión con IA»: `apr_` + 43 caracteres al azar (256 bits). Se muestra una sola vez al crearlo; en la base solo vive su huella
 * (SHA-256), así que ni una filtración de la base ni un administrador pueden recuperarlo. Al ser de 256 bits al azar, una huella sin sal basta (no es una
 * contraseña de persona: no se puede adivinar ni buscar en un diccionario).
 */
export const PREFIJO_TOKEN = "apr_";
const FORMATO = /^apr_[A-Za-z0-9_-]{43}$/;

export const generarToken = (): string => PREFIJO_TOKEN + randomBytes(32).toString("base64url");

export const huellaDeToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

/** Lo que se ve en la lista para reconocerlo sin poder usarlo: «apr_Ab3x…». */
export const prefijoVisible = (token: string): string => token.slice(0, 8);

export const esTokenValido = (texto: unknown): texto is string => typeof texto === "string" && FORMATO.test(texto);

/** Saca el token de la cabecera `Authorization: Bearer …` (sin distinguir mayúsculas en «Bearer»). */
export function tokenDeCabecera(cabecera: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(cabecera?.trim() ?? "");
  return m && esTokenValido(m[1]) ? m[1] : null;
}

/** Un JWT de Supabase (el que Claude recibe tras permitir el acceso): tres tramos en base64url separados por puntos. */
const FORMATO_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type Credencial = { tipo: "token"; token: string } | { tipo: "oauth"; jwt: string };

/** Lo que llegó en `Authorization: Bearer …`: un token personal (`apr_…`) o el acceso de Claude por OAuth (un JWT). Cualquier otra cosa, `null`. */
export function credencialDeCabecera(cabecera: string | null): Credencial | null {
  const m = /^Bearer\s+(\S+)$/i.exec(cabecera?.trim() ?? "");
  if (!m) return null;
  const valor: string = m[1];
  if (FORMATO.test(valor)) return { tipo: "token", token: valor };
  if (valor.length <= 4096 && FORMATO_JWT.test(valor)) return { tipo: "oauth", jwt: valor };
  return null;
}
