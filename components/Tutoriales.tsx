"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Clock, ExternalLink, Play, SearchX } from "lucide-react";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Sheet } from "@/components/Sheet";
import { useTutorialesVistos } from "@/components/useTutorialesVistos";
import { sinTildes } from "@/lib/texto";
import {
  GRUPOS_TUTORIAL,
  TUTORIALES,
  anteriorDisponible,
  buscarTutoriales,
  disponible,
  miniatura,
  siguienteDisponible,
  urlIncrustada,
  urlYoutube,
  type Tutorial,
} from "@/lib/tutoriales";

/**
 * Los tutoriales en video, para ver sin salir de la app: un destacado con el avance y el siguiente por ver, buscador, secciones por tema y una hoja que
 * reproduce el video (YouTube en modo de privacidad reforzada). Lo que cada persona ya vio se guarda solo en su navegador.
 */
export function Tutoriales({ abrirNumero = null }: { /** El tutorial que se abre al entrar (enlace `?ver=N`, desde Hoy o desde una ayuda). */ abrirNumero?: number | null }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<number | null>(() => {
    const t = abrirNumero === null ? null : TUTORIALES.find((x) => x.numero === abrirNumero);
    return t && disponible(t) ? t.numero : null;
  });
  const { vistos, marcarVisto } = useTutorialesVistos();
  const abrir = (t: Tutorial) => {
    if (!disponible(t)) return;
    marcarVisto(t.numero);
    setAbierto(t.numero);
  };

  const cerrar = () => {
    setAbierto(null);
    // Si se llegó con un enlace «?ver=N», se quita para que al recargar no vuelva a abrirse.
    if (abrirNumero !== null) window.history.replaceState(null, "", window.location.pathname);
  };

  const alBuscar = useCallback((texto: string) => setBusqueda(texto), []);
  const encontrados = useMemo(() => buscarTutoriales(busqueda, sinTildes), [busqueda]);
  const buscando = busqueda !== "";

  const habilitados = TUTORIALES.filter(disponible);
  const vistosHabilitados = habilitados.filter((t) => vistos.has(t.numero)).length;
  const proximo = habilitados.find((t) => !vistos.has(t.numero)) ?? null;
  const actual = abierto === null ? null : (TUTORIALES.find((t) => t.numero === abierto) ?? null);

  return (
    <div className="space-y-6 pb-6">
      {!buscando ? <Destacado proximo={proximo} total={habilitados.length} vistos={vistosHabilitados} onAbrir={abrir} /> : null}

      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar un tutorial" />

      {encontrados.length === 0 ? (
        <EstadoVacio icono={<SearchX strokeWidth={1.75} />} titulo="No encontramos ese tutorial" descripcion="Prueba con otra palabra, por ejemplo «leche», «animal» o «Excel»." />
      ) : (
        GRUPOS_TUTORIAL.map((g) => {
          const delGrupo = encontrados.filter((t) => t.grupo === g.id);
          if (delGrupo.length === 0) return null;
          return (
            <section key={g.id} aria-labelledby={`tut-${g.id}`} className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
                <h2 id={`tut-${g.id}`} className="font-display text-xl font-semibold">
                  {g.titulo}
                </h2>
                <p className="text-sm text-humo">{delGrupo.length === 1 ? "1 video" : `${delGrupo.length} videos`}</p>
              </div>
              {!buscando ? <p className="-mt-2 mb-3 px-1 text-[0.9375rem] text-humo">{g.detalle}</p> : null}
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {delGrupo.map((t) => (
                  <li key={t.numero} className="min-w-0">
                    <TarjetaTutorial t={t} visto={vistos.has(t.numero)} onAbrir={abrir} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Sheet
        abierta={actual !== null}
        onCerrar={cerrar}
        titulo={actual ? `Tutorial ${actual.numero}` : undefined}
        ancho="max-w-3xl"
        pie={actual ? <Navegacion actual={actual} onIr={abrir} /> : undefined}
      >
        {actual ? <Reproductor t={actual} alCargar={() => marcarVisto(actual.numero)} /> : null}
      </Sheet>
    </div>
  );
}

/** Lo primero de la pantalla: el avance de la persona y el siguiente tutorial por ver (o, si ya vio todos, un cierre). */
function Destacado({ proximo, total, vistos, onAbrir }: { proximo: Tutorial | null; total: number; vistos: number; onAbrir: (t: Tutorial) => void }) {
  const pct = total > 0 ? Math.round((vistos / total) * 100) : 0;
  const empezando = vistos === 0;
  return (
    <section aria-label="Tu avance" className="grid grid-cols-1 overflow-hidden rounded-[1.75rem] bg-musgo text-sobre-musgo shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {proximo ? (
        <button
          type="button"
          onClick={() => onAbrir(proximo)}
          aria-label={`Ver el tutorial ${proximo.numero}: ${proximo.titulo}`}
          className="group relative order-first block aspect-video w-full overflow-hidden bg-musgo-osc lg:order-last lg:aspect-auto lg:min-h-64"
        >
          <Image src={miniatura(proximo)} alt="" width={800} height={450} sizes="(min-width: 1024px) 480px, 100vw" unoptimized className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/30">
            <span className="grid size-16 place-items-center rounded-full bg-white/95 text-musgo shadow-xl transition group-hover:scale-105">
              <Play className="ml-1 size-7 fill-current" strokeWidth={1.75} aria-hidden="true" />
            </span>
          </span>
        </button>
      ) : null}
      <div className="flex min-w-0 flex-col justify-center gap-3 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">{proximo ? (empezando ? "Empieza por aquí" : "Sigue donde ibas") : "Tutoriales"}</p>
        {proximo ? (
          <>
            <h2 className="font-display text-2xl font-semibold leading-tight [overflow-wrap:anywhere]">{proximo.titulo}</h2>
            <p className="text-[0.9375rem] opacity-90">{proximo.resumen}</p>
            <p className="flex items-center gap-1.5 text-sm opacity-80">
              <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" /> {proximo.duracion} · Tutorial {proximo.numero}
            </p>
            <button
              type="button"
              onClick={() => onAbrir(proximo)}
              className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-semibold text-musgo shadow-sm transition hover:brightness-95 active:scale-[0.98] sm:w-auto sm:self-start"
            >
              <Play className="size-5 fill-current" strokeWidth={1.75} aria-hidden="true" /> {empezando ? "Ver el primer tutorial" : "Ver el siguiente"}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold leading-tight">¡Viste todos los tutoriales disponibles!</h2>
            <p className="text-[0.9375rem] opacity-90">Ya conoces Apriscol de principio a fin. Cuando se publiquen más, aparecerán aquí.</p>
          </>
        )}
        {total > 0 ? (
          <div className="mt-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={vistos} aria-label="Tutoriales vistos">
              <div className="h-full rounded-full bg-ocre transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-sm opacity-80">
              {vistos} de {total} {total === 1 ? "tutorial visto" : "tutoriales vistos"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TarjetaTutorial({ t, visto, onAbrir }: { t: Tutorial; visto: boolean; onAbrir: (t: Tutorial) => void }) {
  const lista = disponible(t);
  return (
    <button
      type="button"
      onClick={() => onAbrir(t)}
      disabled={!lista}
      aria-label={lista ? `Ver el tutorial ${t.numero}: ${t.titulo}${visto ? " (ya visto)" : ""}` : `Tutorial ${t.numero}: ${t.titulo} (próximamente)`}
      className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-papel text-left ring-1 ring-arena transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg enabled:hover:ring-musgo/40 enabled:active:scale-[0.99] disabled:cursor-default"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-arena">
        <Image
          src={miniatura(t)}
          alt=""
          width={800}
          height={450}
          sizes="(min-width: 1280px) 340px, (min-width: 640px) 45vw, 100vw"
          unoptimized
          loading="lazy"
          className={`size-full object-cover transition duration-500 ${lista ? "group-hover:scale-[1.04]" : "opacity-60 saturate-50"}`}
        />
        {lista ? (
          <>
            <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/20">
              <span className="grid size-14 place-items-center rounded-full bg-white/95 text-musgo opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Play className="ml-0.5 size-6 fill-current" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </span>
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">{t.duracion}</span>
            {visto ? (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-musgo px-2.5 py-1 text-xs font-semibold text-sobre-musgo shadow">
                <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> Visto
              </span>
            ) : null}
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-black/35">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-semibold text-tinta shadow">
              <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" /> Próximamente
            </span>
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-ocre">Tutorial {t.numero}</span>
        <span className="font-display text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{t.titulo}</span>
        <span className="line-clamp-2 text-sm text-humo [overflow-wrap:anywhere]">{t.resumen}</span>
      </span>
    </button>
  );
}

/** El video y lo que se aprende en él. El video se carga solo al abrir la hoja, no antes. */
function Reproductor({ t, alCargar }: { t: Tutorial; alCargar: () => void }) {
  const src = urlIncrustada(t);
  const enYoutube = urlYoutube(t);
  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-md">
        {src ? (
          <iframe
            key={t.numero}
            src={src}
            title={`Tutorial ${t.numero}: ${t.titulo}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={alCargar}
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{t.titulo}</h3>
        <p className="mt-1 text-[0.9375rem] text-humo">{t.resumen}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-humo">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" /> {t.duracion}
          </span>
          {enYoutube ? (
            <a href={enYoutube} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-musgo underline-offset-2 hover:underline">
              Abrir en YouTube <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/** Anterior y siguiente (entre los que ya se pueden ver) sin cerrar la hoja. */
function Navegacion({ actual, onIr }: { actual: Tutorial; onIr: (t: Tutorial) => void }) {
  const anterior = anteriorDisponible(actual.numero);
  const siguiente = siguienteDisponible(actual.numero);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Boton variante="secundario" onClick={() => anterior && onIr(anterior)} disabled={!anterior} aria-label={anterior ? `Anterior: ${anterior.titulo}` : "No hay un tutorial anterior"}>
        <ArrowLeft className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Anterior
      </Boton>
      <Boton onClick={() => siguiente && onIr(siguiente)} disabled={!siguiente} aria-label={siguiente ? `Siguiente: ${siguiente.titulo}` : "No hay un tutorial siguiente todavía"}>
        Siguiente <ArrowRight className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </Boton>
    </div>
  );
}
