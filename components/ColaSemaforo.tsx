"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { colaCruda, guardarCola, indiceActual, leerCola, suscribirCola } from "@/lib/cola-semaforo";

/**
 * Barra que acompaña a quien está resolviendo una señal con varios casos: dice en cuál va, deja pasar al anterior o al siguiente y volver a la
 * lista de la señal. Aparece en cualquier pantalla a la que lleve un caso y se quita sola con la «x» o al terminar el último.
 */
export function ColaSemaforo() {
  const ruta = usePathname();
  const crudo = useSyncExternalStore(suscribirCola, colaCruda, () => null);
  const cola = useMemo(() => leerCola(crudo), [crudo]);

  // El caso en el que se está sale de la ruta actual (o del último guardado si la pantalla es intermedia).
  const indice = cola ? indiceActual(cola, ruta, cola.indice) : 0;
  useEffect(() => {
    if (cola && indice !== cola.indice) guardarCola({ ...cola, indice });
  }, [cola, indice]);

  if (!cola || ruta.startsWith("/semaforos")) return null;
  const total = cola.casos.length;
  const actual = cola.casos[indice];
  const anterior = indice > 0 ? cola.casos[indice - 1] : null;
  const siguiente = indice < total - 1 ? cola.casos[indice + 1] : null;
  const ir = (i: number) => guardarCola({ ...cola, indice: i });
  const cerrar = () => guardarCola(null);

  const clase = "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-musgo ring-1 ring-arena";
  return (
    <div role="region" aria-label="Casos de la señal" className="sticky top-0 z-30 -mx-4 mb-2 border-b border-arena bg-papel/95 px-4 py-2 backdrop-blur lg:mx-0 lg:rounded-2xl lg:border">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
          <span className="font-bold">{cola.titulo}</span>
          <span className="block text-humo">
            Caso {indice + 1} de {total}
            {actual ? ` · ${actual.etiqueta}` : ""}
          </span>
        </p>
        <button type="button" onClick={cerrar} aria-label="Dejar de recorrer los casos" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-humo">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {anterior ? (
          <Link href={anterior.href} onClick={() => ir(indice - 1)} className={clase}>
            <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
          </Link>
        ) : null}
        {siguiente ? (
          <Link href={siguiente.href} onClick={() => ir(indice + 1)} className={`${clase} bg-musgo text-papel ring-0`}>
            Siguiente <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link href={`/semaforos?area=${encodeURIComponent(cola.area)}&s=${encodeURIComponent(cola.senal)}`} onClick={cerrar} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
          {siguiente ? "Volver a la lista" : "Terminé: volver a la lista"}
        </Link>
      </div>
    </div>
  );
}
