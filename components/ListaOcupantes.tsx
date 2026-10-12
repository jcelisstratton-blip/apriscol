"use client";

import Link from "next/link";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { formatoFecha } from "@/lib/fechas";

export type Ocupante = { id: string; etiqueta: string; desde: string; dias: number };

/** Los animales que están ahora en una instalación, desde cuándo y cuántos días llevan. Muestra todos, de a tramos. */
export function ListaOcupantes({ ocupantes }: { ocupantes: Ocupante[] }) {
  return (
    <ListaPorTramos
      items={ocupantes}
      clave={(o) => o.id}
      tramo={20}
      fila={(o) => (
        <Link href={`/hato/${o.id}#ubicacion`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-lana px-3 py-2">
          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{o.etiqueta}</span>
          <span className="shrink-0 text-right text-sm text-humo">
            desde el {formatoFecha(o.desde, { day: "numeric", month: "short" })}
            <span className="block text-xs">{o.dias === 0 ? "entró hoy" : `${o.dias} ${o.dias === 1 ? "día" : "días"}`}</span>
          </span>
        </Link>
      )}
    />
  );
}
