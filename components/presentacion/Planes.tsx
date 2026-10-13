"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANES, precioMes } from "@/lib/planes";

const pesos = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Los cuatro planes con el cambio mensual / anual. `hrefCrear` lleva a crear la cuenta. */
export function Planes({ hrefCrear }: { hrefCrear: string }) {
  const [anual, setAnual] = useState(false);
  const boton = (activo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 transition ${activo ? "bg-musgo text-sobre-musgo ring-musgo" : "bg-papel text-tinta ring-arena hover:ring-musgo/40"}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Periodo de pago">
        <button type="button" onClick={() => setAnual(false)} aria-pressed={!anual} className={boton(!anual)}>
          Mensual
        </button>
        <button type="button" onClick={() => setAnual(true)} aria-pressed={anual} className={boton(anual)}>
          Anual · 20 % menos
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 lg:grid-cols-4">
        {PLANES.map((p) => {
          const mes = precioMes(p, anual);
          return (
            <li key={p.id} className={`flex min-w-0 flex-col rounded-3xl bg-papel p-5 ${p.recomendado ? "ring-2 ring-musgo" : "ring-1 ring-arena"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-semibold leading-tight">{p.nombre}</h3>
                {p.recomendado ? <span className="rounded-full bg-musgo/10 px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-musgo">Recomendado</span> : null}
              </div>
              <p className="mt-1.5 min-h-[3.25rem] text-[0.9375rem] text-humo">{p.para}</p>

              <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 font-display text-4xl font-semibold tabular-nums tracking-tight">
                {pesos(mes)}
                <span className="font-sans text-sm font-normal text-humo">/ mes</span>
              </p>
              <p className="mt-1 font-mono text-xs text-humo">{anual ? `Pagando cada año · ${pesos(mes * 12)} al año` : "Pagando cada mes"}</p>

              <Link
                href={hrefCrear}
                className={`mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-base font-semibold transition active:scale-[0.98] ${p.recomendado ? "bg-musgo text-sobre-musgo hover:brightness-110" : "text-musgo ring-1 ring-musgo/40 hover:bg-musgo/5"}`}
              >
                Elegir {p.nombre}
              </Link>

              <ul className="mt-5 space-y-2 border-t border-arena pt-4">
                {p.limites.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} aria-hidden="true" />
                    {l}
                  </li>
                ))}
                {p.incluyeDe ? (
                  <li className="flex items-start gap-2 text-[0.9375rem] text-humo">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} aria-hidden="true" />
                    Todo lo del plan {p.incluyeDe}
                  </li>
                ) : null}
                {p.funciones.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
