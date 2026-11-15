"use client";

import { useSyncExternalStore } from "react";
import { Zap } from "lucide-react";
import { abrirAlGrano, CLAVE_AL_GRANO_VISTO, EVENTO_AL_GRANO_VISTO, marcarAlGranoVisto } from "@/lib/al-grano";

/**
 * Aviso de primera vez en Hoy: dónde está «Al grano» y para qué sirve, con un botón que lo abre. Se oculta solo cuando la persona lo usa o toca «Entendido».
 * Una tarjeta suave (no un cuadro de color) porque es una sugerencia, no un problema.
 */
export function AvisoAlGrano() {
  const visto = useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO_AL_GRANO_VISTO, avisar);
      return () => window.removeEventListener(EVENTO_AL_GRANO_VISTO, avisar);
    },
    () => {
      try {
        return localStorage.getItem(CLAVE_AL_GRANO_VISTO) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  if (visto) return null;

  return (
    <section aria-label="Un atajo para todo" className="mb-4 flex min-w-0 items-start gap-3.5 rounded-3xl bg-papel p-3.5 ring-1 ring-arena lg:max-w-xl">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ocre/15 text-ocre" aria-hidden="true">
        <Zap className="size-6" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold leading-snug">Un atajo para todo: «Al grano»</h2>
        <p className="mt-0.5 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
          <span className="lg:hidden">Toca el botón del rayo, en el centro de la barra de abajo,</span>
          <span className="hidden lg:inline">Toca «Al grano», arriba en el menú de la izquierda,</span> y escribe lo que quieres hacer: «ordeño», «vacuna», «compra»… Te lleva directo, sin buscar en los menús.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => {
              marcarAlGranoVisto();
              abrirAlGrano();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-musgo px-4 text-[0.9375rem] font-semibold text-sobre-musgo shadow-sm transition hover:brightness-110 active:scale-[0.98]"
          >
            <Zap className="size-4" strokeWidth={2.2} aria-hidden="true" /> Probarlo ahora
          </button>
          <button type="button" onClick={marcarAlGranoVisto} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
            Entendido
          </button>
        </div>
      </div>
    </section>
  );
}
