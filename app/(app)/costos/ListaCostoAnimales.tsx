"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { etiquetaAnimal } from "@/lib/animal";
import { pesos } from "@/lib/ferias";

export type CostoAnimalFila = { animal_id: string; numero_arete: string; nombre: string | null; estado: string; directo: number; repartido: number; total: number; valor_compra: number | null };

/** El costo de cada animal en el periodo, del que más cuesta al que menos. Ya viene completo del servidor: se busca y se muestra por tramos. */
export function ListaCostoAnimales({ filas }: { filas: CostoAnimalFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t.toLowerCase()), []);
  const visibles = busqueda ? filas.filter((f) => f.numero_arete.toLowerCase().includes(busqueda) || (f.nombre ?? "").toLowerCase().includes(busqueda)) : filas;

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<PawPrint strokeWidth={1.5} />}
          titulo={busqueda ? "Nada con esa búsqueda" : "Ningún animal tiene costos en este periodo"}
          descripcion={busqueda ? "Prueba con otro arete o nombre." : "Carga compras a un animal, a su lote, a su corral o a su especie, o registra el costo de sus tratamientos, y aquí verás cuánto cuesta cada uno."}
        />
      ) : (
        <ListaPorTramos
          key={busqueda}
          items={visibles}
          clave={(f) => f.animal_id}
          fila={(f) => (
            <Link href={`/hato/${f.animal_id}#costos`} className="block min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena transition active:scale-[0.99]">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-bold [overflow-wrap:anywhere]">{etiquetaAnimal(f)}</span>
                  <span className="block text-sm text-humo">
                    Directo {pesos(f.directo)} · Repartido {pesos(f.repartido)}
                  </span>
                </span>
                <span className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(f.total)}</span>
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {f.estado !== "activo" ? <Insignia>Fuera del hato</Insignia> : null}
                {f.valor_compra != null ? <span className="text-xs text-humo">Compra {pesos(f.valor_compra)}</span> : null}
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
