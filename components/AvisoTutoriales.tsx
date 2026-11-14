"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, X } from "lucide-react";
import { useTutorialesVistos } from "@/components/useTutorialesVistos";
import { miniatura, proximoSinVer, rutaTutorial } from "@/lib/tutoriales";

const CLAVE = (fincaId: string) => `apriscol:tutoriales-aviso-oculto:${fincaId}`;
const EVENTO = "apriscol:tutoriales-aviso-oculto";

/**
 * El aviso de Hoy que ofrece los tutoriales en video: el siguiente que la persona no ha visto, con un botón que lo abre directo. Se puede ocultar (queda en este
 * navegador, por finca) y desaparece solo cuando ya vio todos los disponibles. Hoy lo muestra a las fincas nuevas y, por ser algo nuevo, a todas por un tiempo.
 */
export function AvisoTutoriales({ fincaId }: { fincaId: string }) {
  const clave = CLAVE(fincaId);
  const guardada = useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar);
      return () => window.removeEventListener(EVENTO, avisar);
    },
    () => {
      try {
        return localStorage.getItem(clave) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const { vistos } = useTutorialesVistos();
  const proximo = proximoSinVer(vistos);
  if (guardada || !proximo) return null;

  const ocultar = () => {
    try {
      localStorage.setItem(clave, "1");
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      /* sin almacenamiento: el aviso vuelve en la próxima visita */
    }
  };
  const empezando = vistos.size === 0;

  return (
    <section aria-label="Tutoriales en video" className="relative mb-4 flex min-w-0 items-center gap-3.5 overflow-hidden rounded-3xl bg-musgo p-3.5 pr-12 text-sobre-musgo shadow-sm lg:max-w-xl">
      <Link href={rutaTutorial(proximo.numero)} aria-label={`Ver el tutorial ${proximo.numero}: ${proximo.titulo}`} className="group relative hidden aspect-video w-36 shrink-0 overflow-hidden rounded-2xl bg-musgo-osc sm:block">
        <Image src={miniatura(proximo)} alt="" width={800} height={450} sizes="144px" unoptimized className="size-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <span className="grid size-10 place-items-center rounded-full bg-white/95 text-musgo shadow-lg">
            <Play className="ml-0.5 size-[1.125rem] fill-current" strokeWidth={1.75} aria-hidden="true" />
          </span>
        </span>
      </Link>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 sm:hidden" aria-hidden="true">
        <Play className="ml-0.5 size-5 fill-current" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-80">{empezando ? "Nuevo" : "Tutoriales en video"}</p>
        <h2 className="font-display text-lg font-semibold leading-snug">{empezando ? "Aprende Apriscol en video" : "Sigue aprendiendo"}</h2>
        <p className="mt-0.5 text-sm opacity-90 [overflow-wrap:anywhere]">
          {empezando ? "Empieza por" : "Sigue con"} el Tutorial {proximo.numero}: {proximo.titulo} ({proximo.duracion}).
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={rutaTutorial(proximo.numero)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-[0.9375rem] font-semibold text-musgo shadow-sm transition hover:brightness-95 active:scale-[0.98]">
            <Play className="size-4 fill-current" strokeWidth={1.75} aria-hidden="true" /> Ver ahora
          </Link>
          <Link href="/mas/tutoriales" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold underline-offset-4 hover:underline">
            Ver todos
          </Link>
        </div>
      </div>
      <button type="button" onClick={ocultar} aria-label="Ocultar este aviso" className="absolute right-1.5 top-1.5 grid size-10 place-items-center rounded-full opacity-80 transition hover:bg-white/15 hover:opacity-100">
        <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </section>
  );
}
