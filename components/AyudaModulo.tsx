"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CircleHelp, Clock, Play } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import type { Ayuda } from "@/lib/ayuda";
import { TUTORIALES, disponible, miniatura, rutaTutorial, type Tutorial } from "@/lib/tutoriales";

/** El botón «¿Cómo funciona?» de una vista de trabajo: abre una hoja corta con lo esencial. Reemplaza los párrafos de explicación. */
export function AyudaModulo({ ayuda }: { ayuda: Ayuda }) {
  const [abierta, setAbierta] = useState(false);
  // El tutorial del módulo: siempre se muestra (para que se sepa que existe). Si su video ya está publicado se puede abrir; si no, dice «Próximamente» y se activa solo al ponerle su enlace.
  const video = ayuda.tutorial === undefined ? null : (TUTORIALES.find((t) => t.numero === ayuda.tutorial) ?? null);
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
        {video ? <TarjetaVideo t={video} /> : null}
        <Link href={ayuda.enlace.href} className="mt-3 inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          {ayuda.enlace.texto}
        </Link>
      </Sheet>
    </>
  );
}

/** La tarjeta «Míralo en video» de una ayuda: abre el tutorial de ese módulo; si su video todavía no está publicado, se ve apagada con «Próximamente». */
function TarjetaVideo({ t }: { t: Tutorial }) {
  const lista = disponible(t);
  const contenido = (
    <>
      <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-arena">
        <Image src={miniatura(t)} alt="" width={800} height={450} sizes="112px" unoptimized className={`size-full object-cover ${lista ? "" : "opacity-60 saturate-50"}`} />
        <span className={`absolute inset-0 grid place-items-center ${lista ? "bg-black/20" : "bg-black/35"}`}>
          <span className="grid size-8 place-items-center rounded-full bg-white/95 text-musgo shadow">
            {lista ? <Play className="ml-0.5 size-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" /> : <Clock className="size-3.5" strokeWidth={1.9} aria-hidden="true" />}
          </span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.12em] text-ocre">{lista ? "Míralo en video" : "Tutorial en video"}</span>
        <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{t.titulo}</span>
        <span className="block text-sm text-humo">
          Tutorial {t.numero} · {lista ? t.duracion : "Próximamente"}
        </span>
      </span>
    </>
  );
  return lista ? (
    <Link href={rutaTutorial(t.numero)} className="group mt-5 flex items-center gap-3 rounded-2xl bg-lana p-2 pr-4 ring-1 ring-arena transition hover:ring-musgo/40 active:scale-[0.99]">
      {contenido}
    </Link>
  ) : (
    <div role="note" aria-label={`Tutorial ${t.numero}: ${t.titulo} (próximamente)`} className="mt-5 flex items-center gap-3 rounded-2xl bg-lana p-2 pr-4 ring-1 ring-arena">
      {contenido}
    </div>
  );
}
