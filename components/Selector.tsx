"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { CLASE_INPUT } from "@/components/Campo";

export type Opcion<T extends string | number> = { valor: T; etiqueta: string; detalle?: string };

/** Lista desplegable: hoja inferior en el celular. Nunca un <select> nativo. */
export function Selector<T extends string | number>({
  id,
  nombre,
  valor,
  opciones,
  onCambio,
  titulo,
  placeholder = "Elegir…",
  permitirVacio,
}: {
  id?: string;
  nombre?: string;
  valor: T | "";
  opciones: Opcion<T>[];
  onCambio: (v: T | "") => void;
  titulo: string;
  placeholder?: string;
  permitirVacio?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const actual = opciones.find((o) => o.valor === valor);

  return (
    <>
      {nombre ? <input type="hidden" name={nombre} value={valor} /> : null}
      <button
        id={id}
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className={`${CLASE_INPUT} flex items-center justify-between gap-3 text-left`}
      >
        <span className={`min-w-0 flex-1 ${actual ? "" : "text-humo/70"}`}>{actual ? actual.etiqueta : placeholder}</span>
        <ChevronDown className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
      </button>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>
        <ul className="-mx-2 space-y-0.5">
          {permitirVacio ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  onCambio("");
                  setAbierta(false);
                }}
                className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-humo hover:bg-arena/60"
              >
                Sin especificar
              </button>
            </li>
          ) : null}
          {opciones.map((o) => (
            <li key={o.valor}>
              <button
                type="button"
                onClick={() => {
                  onCambio(o.valor);
                  setAbierta(false);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-arena/60"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{o.etiqueta}</span>
                  {o.detalle ? <span className="block text-sm text-humo">{o.detalle}</span> : null}
                </span>
                {o.valor === valor ? <Check className="size-5 shrink-0 text-musgo" strokeWidth={2} /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
