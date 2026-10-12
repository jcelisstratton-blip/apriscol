"use client";

import { ListaPorTramos } from "@/components/ListaPorTramos";
import { formatoFecha, litros as fmt } from "@/lib/fechas";

export type DiaLeche = { fecha: string; manana: number; tarde: number; noche: number; unico: number; descartados: number; total: number };

/** Lo que dio un animal día por día, con cada jornada, del más reciente al más antiguo. */
export function TablaDiasLeche({ dias }: { dias: DiaLeche[] }) {
  const mostrar = (n: number) => (n > 0 ? fmt(n) : "—");
  const conUnico = dias.some((d) => d.unico > 0);
  return (
    <ListaPorTramos
      items={dias}
      clave={(d) => d.fecha}
      tramo={14}
      fila={(d) => (
        <div className="rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">{formatoFecha(d.fecha, { weekday: "short", day: "numeric", month: "short" })}</p>
            <p className="font-display text-xl font-semibold tabular-nums">{fmt(d.total)} L</p>
          </div>
          <dl className={`mt-1 grid gap-2 text-center text-sm ${conUnico ? "grid-cols-4" : "grid-cols-3"}`}>
            {[
              ["Mañana", d.manana],
              ["Tarde", d.tarde],
              ["Noche", d.noche],
              ...(conUnico ? [["Único", d.unico] as [string, number]] : []),
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta as string} className="min-w-0">
                <dt className="text-xs text-humo">{etiqueta}</dt>
                <dd className="font-semibold tabular-nums">{mostrar(valor as number)}</dd>
              </div>
            ))}
          </dl>
          {d.descartados > 0 ? <p className="mt-1 text-xs text-humo">{fmt(d.descartados)} L descartados</p> : null}
        </div>
      )}
    />
  );
}
