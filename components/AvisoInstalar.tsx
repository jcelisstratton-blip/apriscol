"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Share, Smartphone } from "lucide-react";
import { RUTA_INSTALAR } from "@/lib/instalar";
import { avisoTexto, instalarDirecto, ocultarAviso, puedeInstalarDirecto, suscribirInstalar } from "@/lib/instalar-navegador";
import { dentroDeApp } from "@/lib/instalar";

const nada = () => () => {};

/**
 * Invita a instalar Apriscol en la pantalla de inicio del celular, para abrirla sin señal de un toque y para que el celular no borre lo guardado sin
 * señal (en iPhone es lo que lo protege). Con Chrome o Edge ofrece «Instalar» directo; si el navegador no lo permite, y siempre en iPhone, dice los
 * pasos, y «Ver cómo» lleva a Mi finca → Instalar la app. No sale en el computador, si ya está instalada ni durante unos días tras «Ahora no»
 * (`lib/instalar.ts`, `lib/instalar-navegador.ts`). Una tarjeta suave: es una sugerencia, no un problema.
 */
export function AvisoInstalar({ className = "" }: { className?: string }) {
  const plataforma = useSyncExternalStore(suscribirInstalar, avisoTexto, () => "" as const);
  const directo = useSyncExternalStore(suscribirInstalar, puedeInstalarDirecto, () => false);
  const enOtraApp = useSyncExternalStore(nada, () => dentroDeApp(navigator.userAgent), () => false);
  if (!plataforma) return null;

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
        {enOtraApp ? (
          <p className="mt-2 text-[0.9375rem]">Estás dentro de otra app: abre esta página en {plataforma === "ios" ? "Safari" : "Chrome"} para poder instalarla.</p>
        ) : plataforma === "ios" ? (
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
        ) : !directo ? (
          <p className="mt-2 text-[0.9375rem]">Abre el menú del navegador (los tres puntos) y toca «Instalar aplicación» o «Agregar a la pantalla principal».</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {directo ? (
            <button
              type="button"
              onClick={() => void instalarDirecto()}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-musgo px-4 text-[0.9375rem] font-semibold text-sobre-musgo shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              Instalar
            </button>
          ) : (
            <Link href={RUTA_INSTALAR} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
              Ver cómo
            </Link>
          )}
          <button type="button" onClick={ocultarAviso} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-humo underline-offset-4 hover:underline">
            Ahora no
          </button>
        </div>
      </div>
    </section>
  );
}
