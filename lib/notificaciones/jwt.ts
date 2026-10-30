import { createHmac, timingSafeEqual } from "node:crypto";

const base64Url = (dato: string | Buffer) => Buffer.from(dato).toString("base64url");

/**
 * Firma un JWT HS256 de corta vida con el secreto JWT del proyecto. Sirve para que el servidor actúe «como» una persona (`role = authenticated` y `sub`) o como el
 * servicio (`role = service_role`) sin tener su sesión: la base lo trata igual que uno emitido por Supabase Auth. Quien tenga el secreto puede hacerse pasar por
 * cualquiera: vive solo en el entorno del servidor.
 */
export function firmarJwt({ sub, role, secreto, ahora = Date.now(), ttlSegundos = 60 }: { sub?: string; role: "authenticated" | "service_role"; secreto: string; ahora?: number; ttlSegundos?: number }): string {
  if (!secreto) throw new Error("Falta el secreto para firmar.");
  if (role === "authenticated" && !sub) throw new Error("Un JWT de persona necesita su identificador.");
  const iat = Math.floor(ahora / 1000);
  const cabecera = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const carga = base64Url(JSON.stringify({ aud: "authenticated", role, ...(sub ? { sub } : {}), iat, exp: iat + ttlSegundos }));
  const firma = createHmac("sha256", secreto).update(`${cabecera}.${carga}`).digest("base64url");
  return `${cabecera}.${carga}.${firma}`;
}

/** Comprueba la firma y la vigencia (lo usan las pruebas; la base hace lo mismo al recibirlo). */
export function leerJwt(token: string, secreto: string, ahora = Date.now()): Record<string, unknown> | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const esperada = createHmac("sha256", secreto).update(`${partes[0]}.${partes[1]}`).digest();
  const recibida = Buffer.from(partes[2], "base64url");
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  const carga = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as Record<string, unknown>;
  return typeof carga.exp === "number" && carga.exp * 1000 > ahora ? carga : null;
}
