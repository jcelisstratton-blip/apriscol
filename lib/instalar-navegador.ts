import { avisoInstalarVisible, CLAVE_INSTALAR_OCULTO, dentroDeApp, navegadorDe, plataformaDe, type Plataforma } from "@/lib/instalar";

/**
 * Lo que el navegador dice sobre instalar Apriscol, en un solo lugar para el aviso de Hoy (`AvisoInstalar`) y la pantalla «Instalar la app»
 * (`InstalarApp`). Solo navegador (sin `"use client"`: lo usan componentes de cliente). Chrome y Edge ofrecen instalar con el evento
 * `beforeinstallprompt` una sola vez al cargar la página: se escucha apenas carga este módulo (lo importa `RegistrarSW`, que está en todas las
 * pantallas) y se guarda, para que el botón «Instalar» funcione aunque la persona llegue después a la pantalla.
 */
export type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const EVENTO = "apriscol:instalar";
let guardado: EventoInstalar | null = null;
const avisar = () => window.dispatchEvent(new Event(EVENTO));

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    guardado = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    guardado = null;
    ocultarAviso();
  });
}

/** Para `useSyncExternalStore`: cambia al ocultar el aviso, al poder instalar y al instalar. */
export function suscribirInstalar(cambio: () => void): () => void {
  window.addEventListener(EVENTO, cambio);
  const vista = window.matchMedia("(display-mode: standalone)");
  vista.addEventListener?.("change", cambio);
  return () => {
    window.removeEventListener(EVENTO, cambio);
    vista.removeEventListener?.("change", cambio);
  };
}

export const puedeInstalarDirecto = () => guardado !== null;

/** Abre la ventana de instalar del navegador. Devuelve si la persona aceptó. */
export async function instalarDirecto(): Promise<boolean> {
  const e = guardado;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  guardado = null;
  if (outcome === "accepted") ocultarAviso();
  else avisar();
  return outcome === "accepted";
}

export function leerOculto(): string | null {
  try {
    return localStorage.getItem(CLAVE_INSTALAR_OCULTO);
  } catch {
    return null;
  }
}

/** «Ahora no» o ya instalada (en la pestaña del navegador sigue sin verse como app): se recuerda la fecha. */
export function ocultarAviso() {
  try {
    localStorage.setItem(CLAVE_INSTALAR_OCULTO, new Date().toISOString());
  } catch {
    // Sin almacenamiento no se puede recordar: volverá a salir.
  }
  avisar();
}

/** Vuelve a mostrar el aviso de Hoy (desde «Instalar la app»). */
export function mostrarAviso() {
  try {
    localStorage.removeItem(CLAVE_INSTALAR_OCULTO);
  } catch {
    // Nada que hacer.
  }
  avisar();
}

export const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const tactil = () => window.matchMedia("(pointer: coarse)").matches;

export type Aparato = { plataforma: Plataforma; navegador: string; dentroDeApp: boolean; instalada: boolean; directo: boolean; oculto: boolean };

/** Cómo está este aparato, en texto (para `useSyncExternalStore`, que necesita un valor que no cambie si nada cambió). */
export function aparatoTexto(): string {
  const ua = navigator.userAgent;
  const a: Aparato = {
    plataforma: plataformaDe(ua, navigator.maxTouchPoints ?? 0, tactil()),
    navegador: navegadorDe(ua),
    dentroDeApp: dentroDeApp(ua),
    instalada: estaInstalada(),
    directo: puedeInstalarDirecto(),
    oculto: !avisoInstalarVisible({ instalada: false, plataforma: "android", ocultoEn: leerOculto(), ahora: new Date() }),
  };
  return JSON.stringify(a);
}

/** Qué aviso mostrar en Hoy («» = ninguno). */
export function avisoTexto(): Plataforma | "" {
  const p = plataformaDe(navigator.userAgent, navigator.maxTouchPoints ?? 0, tactil());
  return avisoInstalarVisible({ instalada: estaInstalada(), plataforma: p, ocultoEn: leerOculto(), ahora: new Date() }) ? p : "";
}
