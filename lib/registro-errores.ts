/**
 * Registro de errores del servidor. Una línea JSON por error, con la marca `[apriscol:error]`, que queda en los registros de
 * Vercel (Runtime Logs) y se puede buscar, filtrar y avisar por ahí. Solo lleva lo necesario para ubicar el fallo:
 * **nunca** la dirección con su parte variable (puede traer un token de invitación), ni cabeceras, ni cookies, ni datos del formulario.
 */
export type ContextoError = { routerKind?: string; routePath?: string; routeType?: string; renderSource?: string };

const MAX_MENSAJE = 300;

/** Oculta lo que parezca un secreto antes de escribirlo al registro: JWT y pares «token=…», «key: …», «password=…». */
const ocultarSecretos = (t: string) =>
  t.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt oculto]").replace(/\b(token|key|apikey|secret|password|clave|contraseña|authorization)\b(\s*[=:]\s*)\S+/gi, "$1$2[oculto]");

export function lineaDeError(err: unknown, metodo: string | undefined, contexto: ContextoError): string {
  const e = err instanceof Error ? err : null;
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  return JSON.stringify({
    marca: "[apriscol:error]",
    ruta: contexto.routePath ?? null, // patrón de la ruta (/hato/[id]), no la dirección real
    tipo: contexto.routeType ?? null, // render | route | action | proxy
    origen: contexto.renderSource ?? null,
    metodo: metodo ?? null,
    digest: digest ?? null,
    nombre: e?.name ?? typeof err,
    mensaje: ocultarSecretos(e?.message ?? String(err)).slice(0, MAX_MENSAJE),
  });
}
