"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share, Smartphone } from "lucide-react";
import { avisoInstalarVisible, CLAVE_INSTALAR_OCULTO, plataformaDe, type Plataforma } from "@/lib/instalar";

/** El evento con el que Chrome en Android ofrece instalar la página (no está en los tipos de TypeScript). */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Se avisa al ocultar o instalar, para que el aviso se vuelva a leer. */
const EVENTO_INSTALAR = "apriscol:instalar";

const leerOculto = () => {
  try {
    return localStorage.getItem(CLAVE_INSTALAR_OCULTO);
  } catch {
    return null;
  }
};

/** «Ahora no» o ya instalada (en la pestaña del navegador sigue sin verse como app): se recuerda la fecha y se vuelve a leer el aviso. */
function ocultar() {
  try {
    localStorage.setItem(CLAVE_INSTALAR_OCULTO, new Date().toISOString());
  } catch {
    // Sin almacenamiento no se puede recordar: volverá a salir.
  }
  window.dispatchEvent(new Event(EVENTO_INSTALAR));
}

/** Qué aviso mostrar en este navegador («» = ninguno). Se lee en el navegador; en el servidor no sale. */
function plataformaVisible(): Plataforma | "" {
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const p = plataformaDe(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  return avisoInstalarVisible({ instalada, plataforma: p, ocultoEn: leerOculto(), ahora: new Date() }) ? p : "";
}

const suscribir = (avisar: () => void) => {
  window.addEventListener(EVENTO_INSTALAR, avisar);
  window.addEventListener("appinstalled", ocultar);
  return () => {
    window.removeEventListener(EVENTO_INSTALAR, avisar);
    window.removeEventListener("appinstalled", ocultar);
  };
};

/**
 * Invita a instalar Apriscol en la pantalla de inicio del celular, para abrirla sin señal de un toque y para que el celular no borre lo guardado sin
 * señal (en iPhone es lo que lo protege). En Android con Chrome ofrece «Instalar» directo; si el navegador no lo permite, y siempre en iPhone, dice los
 * pasos. No sale en el computador, si ya está instalada ni durante unos días tras «Ahora no» (`lib/instalar.ts`). Una tarjeta suave: es una
 * sugerencia, no un problema.
 */
export function AvisoInstalar({ className = "" }: { className?: string }) {
  const plataforma = useSyncExternalStore(suscribir, plataformaVisible, () => "" as const);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const ofrecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", ofrecer);
    return () => window.removeEventListener("beforeinstallprompt", ofrecer);
  }, []);

  if (!plataforma) return null;

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") ocultar();
  };

  return (
    <section aria-label="Instala Apriscol en tu celular" className={`flex min-w-0 items-start gap-3.5 rounded-3xl bg-papel p-3.5 ring-1 ring-arena lg:max-w-xl ${className}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-musgo/12 text-musgo" aria-hidden="true">
        <Smartphone className="size-6" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold leading-snug">Instala Apriscol en tu celular</h2>
        <p className="mt-0.5 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
          {plataforma === "ios"
            ? "En iPhone es lo que protege lo que anotas sin señal: si no la instalas, el iPhone puede borrarlo cuando pasan unos días sin abrirla. Además la abres de un toque, aun sin señal."
            : "La abres de un toque desde la pantalla de inicio, aun sin señal, y el celular guarda mejor lo que anotas sin señal."}
        </p>
        {plataforma === "ios" ? (
          <ol className="mt-2 grid grid-cols-1 gap-1 text-[0.9375rem]">
            <li className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-arena text-xs font-semibold">1</span>
              <span className="min-w-0">
                Toca <Share className="inline size-4 -translate-y-0.5 text-musgo" strokeWidth={2} aria-label="Compartir" /> Compartir, abajo en Safari.
              </span>
            </li>
            <li className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-arena text-xs font-semibold">2</span>
              <span className="min-w-0">Elige «Agregar a inicio» y luego «Agregar».</span>
            </li>
          </ol>
        ) : !evento ? (
          <p className="mt-2 text-[0.9375rem]">Abre el menú del navegador (los tres puntos) y toca «Instalar aplicación» o «Agregar a la pantalla principal».</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {evento ? (
            <button
              type="button"
              onClick={() => void instalar()}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-musgo px-4 text-[0.9375rem] font-semibold text-sobre-musgo shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              Instalar
            </button>
          ) : null}
          <button type="button" onClick={ocultar} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
            Ahora no
          </button>
        </div>
      </div>
    </section>
  );
}
