"use client";

import { Delete } from "lucide-react";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "borrar"] as const;

/** Teclado numérico propio: números grandes, a una mano, sin abrir el teclado del sistema. */
export function Teclado({ onTecla }: { onTecla: (t: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onTecla(t)}
          aria-label={t === "borrar" ? "Borrar" : t === "." ? "Punto decimal" : t}
          className="grid h-14 place-items-center rounded-2xl bg-arena text-2xl font-semibold tabular-nums transition active:scale-95 active:bg-arena/70"
        >
          {t === "borrar" ? <Delete className="size-6" strokeWidth={1.75} /> : t === "." ? "," : t}
        </button>
      ))}
    </div>
  );
}
