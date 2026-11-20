import {
  RUTA_ENVIAR, RUTA_REFERENCIA, enviadosViejos, envioDe, porEnviar, referenciaValida, referenciaVencida, resultadoEnvio, type ReferenciaCampo, type RegistroCampo,
} from "@/lib/campo";
import { actualizarRegistro, borrarRegistros, guardarReferencia, guardarRegistro, leerReferencia, listarRegistros } from "@/lib/offline/campo-db";

/**
 * El motor del registro sin señal (solo navegador): renueva la copia de la finca, envía lo guardado de a uno y deja lista la pantalla `/campo`
 * en el service worker. Lo llaman `useBandejaCampo` (al abrir la app, al volver la señal, al volver a la pestaña y cada 30 s mientras haya algo).
 */

/** Tiempo máximo por petición: con señal débil la petición no falla, se queda colgada. */
const ESPERA_MS = 15_000;

async function pedir(url: string, init: RequestInit = {}): Promise<{ status: number; cuerpo: unknown }> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MS);
  try {
    // `redirect: "manual"`: sin sesión el filtro de entrada redirige al login; eso cuenta como sesión vencida, no como respuesta.
    const res = await fetch(url, { ...init, credentials: "same-origin", redirect: "manual", cache: "no-store", signal: corte.signal });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return { status: 401, cuerpo: null };
    let cuerpo: unknown = null;
    try {
      cuerpo = await res.json();
    } catch {
      cuerpo = null;
    }
    return { status: res.status, cuerpo };
  } catch {
    return { status: 0, cuerpo: null };
  } finally {
    clearTimeout(reloj);
  }
}

/** Pide la copia de la finca si falta, es vieja o es de otra persona o finca. Devuelve la que quedó guardada. */
export async function refrescarReferencia(esperado: { usuarioId: string; fincaId: string } | null, forzar = false): Promise<ReferenciaCampo | null> {
  const actual = await leerReferencia();
  const otra = esperado !== null && actual !== null && (actual.usuario.id !== esperado.usuarioId || actual.finca.id !== esperado.fincaId);
  if (!forzar && !otra && !referenciaVencida(actual, new Date())) return actual;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return actual;
  const { status, cuerpo } = await pedir(RUTA_REFERENCIA);
  const nueva = status === 200 ? referenciaValida(cuerpo) : null;
  if (!nueva) return actual;
  await guardarReferencia(nueva);
  return nueva;
}

export type ResultadoEnvioBandeja = { enviados: number; conError: number; sesionVencida: boolean; sinRed: boolean };

async function enviarTodo(usuarioId: string): Promise<ResultadoEnvioBandeja> {
  const salida: ResultadoEnvioBandeja = { enviados: 0, conError: 0, sesionVencida: false, sinRed: false };
  const registros = await listarRegistros();
  const viejos = enviadosViejos(registros, new Date());
  await borrarRegistros(viejos.map((r) => r.id));
  for (const r of porEnviar(registros, usuarioId)) {
    await actualizarRegistro(r.id, { estado: "enviando", intentos: r.intentos + 1 });
    const { status, cuerpo } = await pedir(RUTA_ENVIAR, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envioDe(r)) });
    const res = resultadoEnvio(status, cuerpo);
    if (res.estado === "enviado") {
      await actualizarRegistro(r.id, { estado: "enviado", enviadoEn: new Date().toISOString(), error: undefined });
      salida.enviados++;
    } else if (res.estado === "error") {
      await actualizarRegistro(r.id, { estado: "error", error: res.error });
      salida.conError++;
    } else {
      // Sin red o sin sesión: queda pendiente y se para la tanda (lo demás tampoco saldría).
      await actualizarRegistro(r.id, { estado: "pendiente" });
      if (res.sesion) salida.sesionVencida = true;
      else salida.sinRed = true;
      break;
    }
  }
  return salida;
}

/** Envía lo pendiente de esa persona, de a uno y en una sola pestaña a la vez (Web Locks; si no existe, igual funciona). */
export async function enviarPendientes(usuarioId: string): Promise<ResultadoEnvioBandeja | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { enviados: 0, conError: 0, sesionVencida: false, sinRed: true };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return enviarTodo(usuarioId);
  return locks.request("apriscol-campo-envio", { ifAvailable: true }, (lock) => (lock ? enviarTodo(usuarioId) : null));
}

/** Guarda un registro hecho en el celular (pendiente de enviar). */
export async function guardarEnCelular(r: Omit<RegistroCampo, "estado" | "intentos" | "creadoEn"> & { creadoEn?: string }): Promise<RegistroCampo> {
  const registro: RegistroCampo = { ...r, creadoEn: r.creadoEn ?? new Date().toISOString(), estado: "pendiente", intentos: 0 };
  await guardarRegistro(registro);
  return registro;
}

/** Le pide al service worker que deje lista `/campo` y sus archivos para abrirla sin señal. */
export function prepararPantallaSinSenal(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ tipo: "preparar-campo" })).catch(() => {});
}

/** ¿Un error al llamar al servidor fue por falta de red (y no un rechazo)? Las acciones del servidor fallan con TypeError sin conexión. */
export function esFallaDeRed(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|red|load failed/i.test(error.message));
}

/**
 * Quién anota en este celular, para un respaldo hecho desde una pantalla con señal (captura de leche, Ceba): la persona de la copia guardada,
 * si es de esa misma finca. El panel la renueva al abrir la app con señal, así que es la de la sesión abierta.
 */
export async function usuarioDelCelular(fincaId: string): Promise<string | null> {
  const ref = await leerReferencia();
  return ref && ref.finca.id === fincaId ? ref.usuario.id : null;
}
