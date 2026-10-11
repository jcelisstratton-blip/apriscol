"use client";

import type { Opcion } from "@/components/Selector";

/** Control segmentado para 2–4 opciones excluyentes (sexo, jornada, propósito). */
export function Segmentado<T extends string>({
  nombre,
  valor,
  opciones,
  onCambio,
  etiqueta,
}: {
  nombre?: string;
  valor: T;
  opciones: Opcion<T>[];
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex gap-1 rounded-2xl bg-arena p-1">
      {nombre ? <input type="hidden" name={nombre} value={valor} /> : null}
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(o.valor)}
            className={`min-h-11 min-w-0 flex-1 rounded-xl px-2 text-[0.9375rem] font-semibold transition ${
              activo ? "bg-papel text-tinta shadow-sm" : "text-humo hover:text-tinta"
            }`}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
