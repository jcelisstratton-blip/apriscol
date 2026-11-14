"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CircleHelp, Play } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import type { Ayuda } from "@/lib/ayuda";
import { TUTORIALES, disponible, miniatura, rutaTutorial } from "@/lib/tutoriales";

/** El botón «¿Cómo funciona?» de una vista de trabajo: abre una hoja corta con lo esencial. Reemplaza los párrafos de explicación. */
export function AyudaModulo({ ayuda }: { ayuda: Ayuda }) {
  const [abierta, setAbierta] = useState(false);
  // El video del módulo, solo cuando ya está publicado: al subir cada tutorial, su ayuda lo ofrece sola.
  const video = ayuda.tutorial === undefined ? null : (TUTORIALES.find((t) => t.numero === ayuda.tutorial && disponible(t)) ?? null);
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
        {video ? (
          <Link
            href={rutaTutorial(video.numero)}
            className="group mt-5 flex items-center gap-3 rounded-2xl bg-lana p-2 pr-4 ring-1 ring-arena transition hover:ring-musgo/40 active:scale-[0.99]"
          >
            <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-arena">
              <Image src={miniatura(video)} alt="" width={800} height={450} sizes="112px" unoptimized className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/20">
                <span className="grid size-8 place-items-center rounded-full bg-white/95 text-musgo shadow">
                  <Play className="ml-0.5 size-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-ocre">Míralo en video</span>
              <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{video.titulo}</span>
              <span className="block text-sm text-humo">
                Tutorial {video.numero} · {video.duracion}
              </span>
            </span>
          </Link>
        ) : null}
        <Link href={ayuda.enlace.href} className="mt-3 inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          {ayuda.enlace.texto}
        </Link>
      </Sheet>
    </>
  );
}
