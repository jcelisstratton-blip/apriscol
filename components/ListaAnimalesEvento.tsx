"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { etiquetaAnimal } from "@/lib/animal";
import { sinTildes } from "@/lib/texto";

type Fila = { id: string; numero_arete: string; nombre: string | null };

/** Los animales que recibieron un evento: cada uno lleva a su ficha. Con buscador cuando son muchos. */
export function ListaAnimalesEvento({ animales }: { animales: Fila[] }) {
  const [texto, setTexto] = useState("");
  const filtrados = texto ? animales.filter((a) => sinTildes(etiquetaAnimal(a)).includes(sinTildes(texto))) : animales;
  return (
    <div className="space-y-3">
      {animales.length > 8 ? <CampoBusqueda onBuscar={setTexto} placeholder="Buscar en estos animales" /> : null}
      {filtrados.length === 0 ? (
        <p className="py-4 text-center text-sm text-humo">Ninguno coincide.</p>
      ) : (
        <ListaPorTramos
          key={texto}
          items={filtrados}
          clave={(a) => a.id}
          fila={(a) => (
            <Link href={`/hato/${a.id}#sanidad`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-papel px-3.5 ring-1 ring-arena">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(a)}</span>
              <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
            </Link>
          )}
        />
      )}
    </div>
  );
}
