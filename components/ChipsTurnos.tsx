"use client";

import { ETIQUETA_TURNO, TURNOS, type Turno } from "@/lib/ordeno";

/** Los tres turnos como botones que se prenden y se apagan. Controlado: quien lo usa guarda el cambio. */
export function ChipsTurnos({
  valor,
  onCambio,
  deshabilitado = false,
  etiqueta = "Turnos de ordeño",
}: {
  valor: Turno[];
  onCambio: (turnos: Turno[]) => void;
  deshabilitado?: boolean;
  etiqueta?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex gap-1.5">
      {TURNOS.map((t) => {
        const activo = valor.includes(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={activo}
            disabled={deshabilitado}
            onClick={() => onCambio(TURNOS.filter((x) => (x === t ? !activo : valor.includes(x))))}
            className={`min-h-11 min-w-0 flex-1 rounded-full px-3 text-sm font-semibold transition disabled:opacity-60 ${
              activo ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {ETIQUETA_TURNO[t]}
          </button>
        );
      })}
    </div>
  );
}
