"use client";

import { useState } from "react";
import { formatoFecha, litros as fmt } from "@/lib/fechas";
import { ETIQUETA_JORNADA, type Barra, type Paso } from "@/lib/leche";

const COLOR = { manana: "bg-musgo", tarde: "bg-ocre", noche: "bg-tinta/70", unico: "bg-humo" } as const;
const JORNADAS = ["manana", "tarde", "noche", "unico"] as const;

/** Un tope «redondo» para el eje (1, 2, 5, 10, 20, 50…) que deja aire sobre la barra más alta. */
function topeRedondo(max: number): number {
  if (max <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (max <= m * potencia) return m * potencia;
  return 10 * potencia;
}

function etiquetaBarra(b: Barra, paso: Paso, larga = false): string {
  if (paso === "dia") return formatoFecha(b.desde, larga ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" });
  if (paso === "semana") return `Del ${formatoFecha(b.desde, { day: "numeric", month: "short" })} al ${formatoFecha(b.hasta, { day: "numeric", month: "short" })}`;
  return formatoFecha(b.desde, { month: "long", year: "numeric" });
}

/**
 * Litros al tanque por día (o por semana o mes si el periodo es largo), apilados por jornada. Lo descartado se ve aparte, arriba, en rojo.
 * Tocar una barra muestra su detalle.
 */
export function GraficoHistorialLeche({ barras, paso }: { barras: Barra[]; paso: Paso }) {
  const [elegida, setElegida] = useState<string | null>(null);
  const maximo = topeRedondo(Math.max(0, ...barras.map((b) => b.total + b.descartados)));
  const sel = barras.find((b) => b.clave === elegida) ?? null;
  const hayJornada = (j: (typeof JORNADAS)[number]) => barras.some((b) => b[j] > 0);
  const hayDescartes = barras.some((b) => b.descartados > 0);
  const medio = barras[Math.floor((barras.length - 1) / 2)];
  const unidad = paso === "dia" ? "día" : paso === "semana" ? "semana" : "mes";

  return (
    <figure className="space-y-2" aria-label={`Litros al tanque por ${unidad}`}>
      <div className="flex gap-2">
        <div className="flex h-44 w-9 shrink-0 flex-col justify-between text-right text-[0.6875rem] tabular-nums text-humo" aria-hidden="true">
          <span>{fmt(maximo)}</span>
          <span>{fmt(maximo / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative h-44 min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            <span className="border-t border-arena" />
            <span className="border-t border-dashed border-arena" />
            <span className="border-t border-arena" />
          </div>
          <div className={`relative flex h-full items-end ${barras.length > 60 ? "gap-px" : "gap-1"}`}>
            {barras.map((b) => {
              const activa = elegida === b.clave;
              return (
                <button
                  key={b.clave}
                  type="button"
                  onClick={() => setElegida(activa ? null : b.clave)}
                  aria-pressed={activa}
                  aria-label={`${etiquetaBarra(b, paso)}: ${b.total > 0 ? `${fmt(b.total)} litros` : "sin ordeño"}`}
                  className={`flex h-full min-w-0 flex-1 items-end rounded-t-sm outline-offset-1 ${elegida && !activa ? "opacity-45" : ""}`}
                >
                  <span className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${((b.total + b.descartados) / maximo) * 100}%` }}>
                    {JORNADAS.map((j) =>
                      b[j] > 0 ? <span key={j} className={`block w-full ${COLOR[j]}`} style={{ height: `${(b[j] / (b.total + b.descartados)) * 100}%` }} /> : null,
                    )}
                    {b.descartados > 0 ? <span className="block w-full bg-rojo/50" style={{ height: `${(b.descartados / (b.total + b.descartados)) * 100}%` }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ml-11 flex justify-between text-[0.6875rem] text-humo" aria-hidden="true">
        <span>{barras.length ? etiquetaBarra(barras[0], paso).replace(/^Del /, "") : ""}</span>
        {barras.length > 6 && medio ? <span>{etiquetaBarra(medio, paso).replace(/^Del /, "")}</span> : null}
        <span>{barras.length ? etiquetaBarra(barras[barras.length - 1], paso).replace(/^Del /, "") : ""}</span>
      </div>

      {sel ? (
        <div className="rounded-2xl bg-lana p-3.5 text-[0.9375rem]" aria-live="polite">
          <p className="font-semibold [overflow-wrap:anywhere]">{etiquetaBarra(sel, paso, true)}</p>
          {sel.total + sel.descartados === 0 ? (
            <p className="mt-1 text-humo">Sin ordeño registrado.</p>
          ) : (
            <>
              <p className="mt-1">
                <span className="font-display text-2xl font-semibold tabular-nums">{fmt(sel.total)} L</span> <span className="text-humo">al tanque</span>
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-humo">
                {JORNADAS.filter((j) => sel[j] > 0).map((j) => (
                  <li key={j} className="inline-flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-sm ${COLOR[j]}`} aria-hidden="true" /> {ETIQUETA_JORNADA[j]} {fmt(sel[j])} L
                  </li>
                ))}
                {sel.descartados > 0 ? (
                  <li className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-rojo/50" aria-hidden="true" /> Descartados {fmt(sel.descartados)} L
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-humo">Toca una barra para ver el detalle.</p>
      )}

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-humo">
        {JORNADAS.filter(hayJornada).map((j) => (
          <span key={j} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${COLOR[j]}`} aria-hidden="true" /> {ETIQUETA_JORNADA[j]}
          </span>
        ))}
        {hayDescartes ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rojo/50" aria-hidden="true" /> Descartados
          </span>
        ) : null}
        {paso !== "dia" ? <span className="ml-auto">Cada barra es {paso === "semana" ? "una semana" : "un mes"}</span> : null}
      </figcaption>
    </figure>
  );
}
