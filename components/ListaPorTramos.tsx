"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Hermana de `ListaEscalable` para listas que ya están completas en el cliente (por ejemplo el ordeño, que
 * necesita todos los animales para el progreso y los totales): dibuja un tramo de 20 filas, agrega otro al
 * llegar al final, muestra «Mostrando X de N» y el botón «Arriba». Para reiniciar al buscar o filtrar,
 * cambia su `key`; los cambios dentro de una fila no la reinician.
 */
export function ListaPorTramos<T>({
  items,
  fila,
  clave,
  tramo = 20,
  arriba = true,
}: {
  items: T[];
  fila: (item: T) => React.ReactNode;
  clave: (item: T) => string;
  tramo?: number;
  /** El botón «Arriba» desplaza la página: no va dentro de una hoja inferior, que se desplaza por dentro. */
  arriba?: boolean;
}) {
  const [visibles, setVisibles] = useState(tramo);
  const [hayScroll, setHayScroll] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);
  const completo = visibles >= items.length;

  useEffect(() => {
    const el = centinela.current;
    if (!el || completo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) setVisibles((v) => v + tramo);
      },
      { rootMargin: "320px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [completo, tramo, visibles]);

  useEffect(() => {
    const alScroll = () => setHayScroll(window.scrollY > 600);
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  const mostradas = items.slice(0, visibles);

  return (
    <div>
      {items.length > tramo ? (
        <p className="mb-2 text-sm text-humo" aria-live="polite">
          Mostrando {mostradas.length} de {items.length}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2.5">
        {mostradas.map((it) => (
          <li key={clave(it)} className="min-w-0">
            {fila(it)}
          </li>
        ))}
      </ul>
      {!completo ? <div ref={centinela} className="h-14" aria-hidden="true" /> : null}
      {arriba && hayScroll ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta px-4 text-sm font-semibold text-lana shadow-lg"
        >
          <ArrowUp className="size-4" strokeWidth={2} /> Arriba
        </button>
      ) : null}
    </div>
  );
}
