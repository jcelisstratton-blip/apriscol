"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Hoja inferior (bottom sheet): patrón móvil estándar para elegir, confirmar o capturar sin salir de la pantalla. */
export function Sheet({
  abierta,
  onCerrar,
  titulo,
  children,
  pie,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo?: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // `onCerrar` casi siempre llega como una función nueva en cada render del padre. Si fuera dependencia del efecto, cada letra escrita en un campo
  // de la hoja lo volvería a ejecutar y le quitaría el foco al campo: por eso se guarda en una referencia y el efecto solo depende de `abierta`.
  const alCerrar = useRef(onCerrar);
  useEffect(() => {
    alCerrar.current = onCerrar;
  });

  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar.current();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [abierta]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <div className="anim-velo absolute inset-0 bg-[var(--velo)]" onClick={onCerrar} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="anim-hoja relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-papel shadow-2xl outline-none sm:rounded-[1.75rem]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-arena sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-3">
          <h2 className="font-display text-xl font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-10 place-items-center rounded-full text-humo hover:bg-arena"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {pie ? <div className="shrink-0 border-t border-arena px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{pie}</div> : null}
        {!pie ? <div className="h-[env(safe-area-inset-bottom)] shrink-0" /> : null}
      </div>
    </div>
  );
}
