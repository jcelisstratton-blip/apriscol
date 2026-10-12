"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { litros as fmt } from "@/lib/fechas";

export type FilaRanking = {
  animal_id: string;
  etiqueta: string;
  tanque: number;
  descartados: number;
  ordenos: number;
  dias: number;
  /** Litros por día de ordeño. */
  promedio: number;
  /** Dirección que abre este animal en Leche. */
  href: string;
  baja?: boolean;
};

/** Cuánto dio cada animal en el periodo, de más a menos. Tocar uno abre su comportamiento: gráfica, turnos y día por día. */
export function RankingLeche({ filas }: { filas: FilaRanking[] }) {
  const maximo = Math.max(0.01, ...filas.map((f) => f.tanque));
  return (
    <ListaPorTramos
      items={filas}
      clave={(f) => f.animal_id}
      tramo={15}
      fila={(f) => (
        <Link href={f.href} className="block min-w-0 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition active:scale-[0.99]">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-bold [overflow-wrap:anywhere]">{f.etiqueta}</span>
              <span className="block text-sm text-humo">
                {fmt(f.promedio)} L por día · {f.ordenos} {f.ordenos === 1 ? "ordeño" : "ordeños"} en {f.dias} {f.dias === 1 ? "día" : "días"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-right">
                <span className="block font-display text-xl font-semibold tabular-nums">{fmt(f.tanque)} L</span>
                {f.descartados > 0 ? <span className="block text-xs text-humo">{fmt(f.descartados)} L descartados</span> : null}
              </span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} aria-hidden="true" />
            </span>
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-arena" aria-hidden="true">
            <span className="block h-full rounded-full bg-musgo" style={{ width: `${(f.tanque / maximo) * 100}%` }} />
          </span>
          {f.baja ? (
            <span className="mt-2 block">
              <Insignia tono="aviso">Su producción viene bajando</Insignia>
            </span>
          ) : null}
        </Link>
      )}
    />
  );
}
