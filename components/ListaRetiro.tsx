"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { formatoFecha } from "@/lib/fechas";
import { sinTildes } from "@/lib/texto";

export type AnimalEnRetiro = { id: string; nombre: string; lecheHasta: string | null; carneHasta: string | null };

const MIN_PARA_BUSCAR = 8;

/** Los animales en periodo de retiro: pueden ser todo el hato, así que van por tramos de 20 y con búsqueda. */
export function ListaRetiro({ animales }: { animales: AnimalEnRetiro[] }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);
  const t = sinTildes(busqueda);
  const visibles = t ? animales.filter((a) => sinTildes(a.nombre).includes(t)) : animales;
  return (
    <div className="space-y-2">
      {animales.length > MIN_PARA_BUSCAR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {visibles.length === 0 ? (
        <p className="py-4 text-center text-[0.9375rem] text-humo">Ningún animal coincide.</p>
      ) : (
        <ListaPorTramos
          key={t}
          items={visibles}
          clave={(a) => a.id}
          fila={(a) => (
            <Link href={`/hato/${a.id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 border-b border-arena py-2">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{a.nombre}</span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {a.lecheHasta ? <Insignia tono="aviso">Leche hasta {formatoFecha(a.lecheHasta, { day: "numeric", month: "short" })}</Insignia> : null}
                {a.carneHasta ? <Insignia tono="alerta">Carne hasta {formatoFecha(a.carneHasta, { day: "numeric", month: "short" })}</Insignia> : null}
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
