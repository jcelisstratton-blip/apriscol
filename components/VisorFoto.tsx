"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";

/** Miniatura que abre la foto completa en una hoja. */
export function VisorFoto({ url, titulo, tamano = "size-16" }: { url: string; titulo: string; tamano?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Ver foto: ${titulo}`}
        className={`${tamano} shrink-0 overflow-hidden rounded-2xl bg-arena ring-1 ring-arena`}
      >
        {/* URL firmada y temporal: no se optimiza con next/image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      </button>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={titulo} className="w-full rounded-2xl" />
      </Sheet>
    </>
  );
}
