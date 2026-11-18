"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ListaEscalable } from "@/components/ListaEscalable";
import { kilosVellon } from "@/lib/esquila";
import { formatoFecha } from "@/lib/fechas";

export type EsquilaDeLista = { id: string; fecha: string; esquilador: string | null; ovejas: number; kg: number | null };

/** Las esquilas ya hechas, la más reciente primero. Cada una abre su detalle. */
export function ListaEsquilas({ esquilas }: { esquilas: EsquilaDeLista[] }) {
  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: esquilas.slice(desde, desde + cantidad), total: esquilas.length }), [esquilas]);
  return (
    <ListaEscalable<EsquilaDeLista>
      cargar={cargar}
      clave={(e) => e.id}
      vacio={<p className="px-2 py-8 text-center text-[0.9375rem] text-humo">Cuando registres una esquila, aparecerá aquí.</p>}
      fila={(e) => (
        <Link href={`/esquila/${e.id}`} className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-2xl bg-papel px-4 py-3 ring-1 ring-arena transition hover:bg-arena/40">
          <span className="min-w-0">
            <span className="block font-semibold">{formatoFecha(e.fecha)}</span>
            <span className="block text-sm text-humo [overflow-wrap:anywhere]">
              {e.ovejas} {e.ovejas === 1 ? "oveja" : "ovejas"}
              {e.esquilador ? ` · ${e.esquilador}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-right font-semibold tabular-nums">{e.kg ? kilosVellon(e.kg) : "—"}</span>
        </Link>
      )}
    />
  );
}
