"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import type { Ayuda } from "@/lib/ayuda";

/** El botón «¿Cómo funciona?» de una vista de trabajo: abre una hoja corta con lo esencial. Reemplaza los párrafos de explicación. */
export function AyudaModulo({ ayuda }: { ayuda: Ayuda }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline"
      >
        <CircleHelp className="size-5" strokeWidth={1.9} aria-hidden="true" /> ¿Cómo funciona?
      </button>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo={ayuda.titulo}>
        <ul className="space-y-3.5">
          {ayuda.puntos.map((p) => (
            <li key={p.titulo}>
              <p className="font-semibold">{p.titulo}</p>
              <p className="text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{p.texto}</p>
            </li>
          ))}
        </ul>
        <Link href={ayuda.enlace.href} className="mt-4 inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          {ayuda.enlace.texto}
        </Link>
      </Sheet>
    </>
  );
}
