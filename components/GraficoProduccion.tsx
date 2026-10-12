import { litros as fmt } from "@/lib/fechas";

export type DiaProduccion = { fecha: string; litros: number | null };

const INICIAL_DIA = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Litros por día de los últimos días (barras). Un día sin registro queda vacío. La línea marca el promedio de los 7 días
 * anteriores a los últimos 3 (la referencia con la que se detecta una baja).
 */
export function GraficoProduccion({ dias, promedioBase }: { dias: DiaProduccion[]; promedioBase: number | null }) {
  const maximo = Math.max(1, ...dias.map((d) => d.litros ?? 0), promedioBase ?? 0);
  const resumen = dias.map((d) => `${d.fecha}: ${d.litros === null ? "sin registro" : `${fmt(d.litros)} L`}`).join("; ");
  return (
    <figure className="space-y-1.5" aria-label="Litros por día de los últimos 14 días">
      <div className="relative flex h-24 items-end gap-1" role="img" aria-label={resumen}>
        {promedioBase ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-humo/60"
            style={{ bottom: `${(promedioBase / maximo) * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
        {dias.map((d, i) => (
          <div key={d.fecha} className="flex h-full min-w-0 flex-1 items-end" title={`${d.fecha}: ${d.litros === null ? "sin registro" : `${fmt(d.litros)} L`}`}>
            <div
              className={`w-full rounded-t-sm ${i >= dias.length - 3 ? "bg-ocre" : "bg-musgo"} ${d.litros === null ? "opacity-0" : ""}`}
              style={{ height: `${d.litros === null ? 0 : Math.max(4, (d.litros / maximo) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {dias.map((d) => (
          <span key={d.fecha} className="min-w-0 flex-1 text-center text-[0.625rem] text-humo">
            {INICIAL_DIA[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()]}
          </span>
        ))}
      </div>
      <figcaption className="flex items-center gap-3 text-xs text-humo">
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-musgo" /> Antes</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-ocre" /> Últimos 3 días</span>
        {promedioBase ? <span className="inline-flex items-center gap-1"><span className="w-3 border-t border-dashed border-humo/60" /> Promedio de antes</span> : null}
      </figcaption>
    </figure>
  );
}
