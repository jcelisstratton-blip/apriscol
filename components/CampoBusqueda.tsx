"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export function CampoBusqueda({
  onBuscar,
  placeholder,
  retardo = 300,
}: {
  onBuscar: (texto: string) => void;
  placeholder: string;
  retardo?: number;
}) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const t = setTimeout(() => onBuscar(texto.trim()), retardo);
    return () => clearTimeout(t);
  }, [texto, retardo, onBuscar]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-humo" strokeWidth={1.75} />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 w-full rounded-2xl border border-arena bg-papel pl-12 pr-11 text-base placeholder:text-humo/70 focus:border-musgo focus:outline-none focus:ring-2 focus:ring-musgo/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {texto ? (
        <button
          type="button"
          onClick={() => setTexto("")}
          aria-label="Borrar búsqueda"
          className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-humo hover:bg-arena"
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
