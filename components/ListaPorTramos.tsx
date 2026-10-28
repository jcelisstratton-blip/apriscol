"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Hermana de `ListaEscalable` para listas que ya están completas en el cliente (por ejemplo el ordeño, que
 * necesita todos los animales para el progreso y los totales): dibuja un tramo de 20 filas, agrega otro al
 * llegar al final, muestra «Mostrando X de N» y el botón «Arriba». Para reiniciar al buscar o filtrar,
 * cambia su `key`; los cambios dentro de una fila no la reinician.
 * Igual que `ListaEscalable`, en pantallas anchas (`lg`) tiene desplazamiento propio (alto máximo ≈ 640 px) para que la página no
 * se alargue; en el celular se desplaza la página (un scroll dentro de otro atrapa el dedo).
 */
export function ListaPorTramos<T>({
  items,
  fila,
  clave,
  tramo = 20,
  arriba = true,
  rejilla = "grid-cols-1",
}: {
  items: T[];
  fila: (item: T) => React.ReactNode;
  clave: (item: T) => string;
  tramo?: number;
  /** El botón «Arriba» desplaza la página: no va dentro de una hoja inferior, que se desplaza por dentro. */
  arriba?: boolean;
  /** Columnas de la rejilla. Empieza siempre con `grid-cols-1` (celular); en pantallas anchas puede abrir más (`grid-cols-1 lg:grid-cols-2`). */
  rejilla?: string;
}) {
  const [visibles, setVisibles] = useState(tramo);
  const [hayScroll, setHayScroll] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
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
    const alScroll = () => setHayScroll(window.scrollY > 600 || (contenedor.current?.scrollTop ?? 0) > 400);
    window.addEventListener("scroll", alScroll, { passive: true });
    const c = contenedor.current;
    c?.addEventListener("scroll", alScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", alScroll);
      c?.removeEventListener("scroll", alScroll);
    };
  }, []);

  const mostradas = items.slice(0, visibles);

  return (
    <div>
      {items.length > tramo ? (
        <p className="mb-2 text-sm text-humo" aria-live="polite">
          Mostrando {mostradas.length} de {items.length}
        </p>
      ) : null}
      <div ref={contenedor} className={arriba ? "lg:max-h-[640px] lg:overflow-y-auto" : undefined}>
        <ul className={`grid gap-2.5 ${rejilla}`}>
          {mostradas.map((it) => (
            <li key={clave(it)} className="min-w-0">
              {fila(it)}
            </li>
          ))}
        </ul>
        {!completo ? <div ref={centinela} className="h-14" aria-hidden="true" /> : null}
      </div>
      {arriba && hayScroll ? (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            contenedor.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta px-4 text-sm font-semibold text-lana shadow-lg"
        >
          <ArrowUp className="size-4" strokeWidth={2} /> Arriba
        </button>
      ) : null}
    </div>
  );
}
