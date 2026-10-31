"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, TriangleAlert, Siren } from "lucide-react";
import { Boton } from "@/components/Boton";
import { Insignia } from "@/components/Insignia";
import { Sheet } from "@/components/Sheet";
import { Tarjeta } from "@/components/Tarjeta";
import { armarCola, guardarCola } from "@/lib/cola-semaforo";
import { ETIQUETA_AREA, type AreaSemaforo, type Nivel, type Senal } from "@/lib/semaforos";

const TRAMO = 20;

const ESTILO: Record<Nivel, { barra: string; fondo: string; etiqueta: string; tono: "alerta" | "aviso" | "ok" }> = {
  rojo: { barra: "border-rojo", fondo: "bg-rojo/8", etiqueta: "Rojo · actúa hoy", tono: "alerta" },
  ambar: { barra: "border-ambar", fondo: "bg-ambar/8", etiqueta: "Ámbar · programa", tono: "aviso" },
  verde: { barra: "border-ok", fondo: "bg-ok/8", etiqueta: "En orden", tono: "ok" },
};

function IconoNivel({ nivel }: { nivel: Nivel }) {
  if (nivel === "rojo") return <Siren className="size-5 text-rojo" strokeWidth={2} aria-hidden="true" />;
  if (nivel === "ambar") return <TriangleAlert className="size-5 text-ambar" strokeWidth={2} aria-hidden="true" />;
  return <CheckCircle2 className="size-5 text-ok" strokeWidth={2} aria-hidden="true" />;
}

/**
 * Panel de semáforos: una tarjeta por señal que no está en verde (rojo primero), agrupadas por área. Al tocar una se abre qué significa, la regla,
 * los animales o elementos afectados y la acción sugerida. Lo que está en orden se resume en una línea.
 */
export function Semaforos({ senales, abiertaInicial = null }: { senales: Senal[]; /** La señal que se abre al entrar (viene del enlace del bot de Telegram). */ abiertaInicial?: string | null }) {
  const [abierta, setAbierta] = useState<string | null>(abiertaInicial && senales.some((s) => s.id === abiertaInicial) ? abiertaInicial : null);
  const [cuantos, setCuantos] = useState(TRAMO);
  const actual = senales.find((s) => s.id === abierta) ?? null;

  const conAviso = senales.filter((s) => s.nivel !== "verde");
  const enOrden = senales.filter((s) => s.nivel === "verde");
  const areas = [...new Set(conAviso.map((s) => s.area))] as AreaSemaforo[];
  const peso = (n: Nivel) => (n === "rojo" ? 0 : 1);

  const abrir = (id: string) => {
    setCuantos(TRAMO);
    setAbierta(id);
  };

  return (
    <div className="space-y-5">
      {conAviso.length === 0 ? (
        <Tarjeta>
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-ok" strokeWidth={2} aria-hidden="true" /> Todo en orden
          </p>
          <p className="mt-1 text-[0.9375rem] text-humo">Ninguna señal pide atención ahora. Aquí aparecerán cuando algo necesite tu revisión.</p>
        </Tarjeta>
      ) : null}

      {areas.map((area) => (
        <section key={area} id={area} aria-label={ETIQUETA_AREA[area]} className="scroll-mt-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-humo">{ETIQUETA_AREA[area]}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {conAviso
              .filter((s) => s.area === area)
              .sort((a, b) => peso(a.nivel) - peso(b.nivel))
              .map((s) => {
                const e = ESTILO[s.nivel];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => abrir(s.id)}
                    className={`flex min-h-24 min-w-0 items-start gap-3 rounded-2xl border-l-4 p-4 text-left ring-1 ring-arena transition active:scale-[0.99] ${e.barra} ${e.fondo}`}
                  >
                    <IconoNivel nivel={s.nivel} />
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span className="block font-semibold leading-snug">{s.titulo}</span>
                      <span className="mt-0.5 block text-sm text-humo">{s.resumen}</span>
                      <span className="mt-1.5 block"><Insignia tono={e.tono}>{e.etiqueta}</Insignia></span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-humo" aria-hidden="true" />
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      {enOrden.length > 0 ? (
        <section aria-label="En orden">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-humo">En orden</h2>
          <div className="flex flex-wrap gap-2">
            {enOrden.map((s) => (
              <button key={s.id} type="button" onClick={() => abrir(s.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ok/10 px-3.5 text-sm font-semibold text-ok ring-1 ring-ok/20">
                <CheckCircle2 className="size-4" strokeWidth={2.2} aria-hidden="true" /> {s.titulo}{s.atendidos.length > 0 ? ` · ${s.atendidos.length} ya ${s.atendidos.length === 1 ? "atendido" : "atendidos"}` : ""}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Sheet abierta={actual !== null} onCerrar={() => setAbierta(null)} titulo={actual?.titulo} ancho="max-w-lg">
        {actual ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Insignia tono={ESTILO[actual.nivel].tono}>{ESTILO[actual.nivel].etiqueta}</Insignia>
              <span className="text-sm text-humo">{actual.resumen}</span>
            </div>

            <div className="rounded-2xl bg-lana p-3.5">
              <h3 className="text-sm font-bold">Qué hacer</h3>
              <p className="mt-0.5 text-[0.9375rem]">{actual.queHacer}</p>
            </div>
            {actual.sigueAqui && (actual.items.length > 0 || actual.atendidos.length > 0) ? (
              <details className="rounded-2xl border border-arena p-3.5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-bold">¿Ya lo hiciste y sigue aquí?</summary>
                <p className="mt-1 text-[0.9375rem] text-humo">{actual.sigueAqui}</p>
              </details>
            ) : null}
            {actual.nota ? <p className="rounded-2xl bg-arena/60 p-3 text-sm text-humo">{actual.nota}</p> : null}

            {actual.items.length === 0 ? (
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ok">
                <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden="true" /> Nada pendiente en esta señal.
              </p>
            ) : (
              <div>
                <h3 className="mb-1 text-sm font-bold">Qué hay que mirar</h3>
                <ul className="divide-y divide-arena">
                  {actual.items.slice(0, cuantos).map((i, n) => (
                    <li key={i.clave}>
                      <Link
                        href={i.href}
                        onClick={() => guardarCola(armarCola(actual, actual.items.map((x) => ({ etiqueta: x.etiqueta, href: x.href })), n))}
                        className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          <span className="block font-semibold">{i.etiqueta}</span>
                          <span className="block text-sm text-humo">{i.detalle}</span>
                          {i.queHacer ? <span className="mt-0.5 block text-sm font-medium">Qué hacer: {i.queHacer}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Insignia tono={i.nivel === "rojo" ? "alerta" : "aviso"}>{i.nivel === "rojo" ? "Rojo" : "Ámbar"}</Insignia>
                          <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm text-humo">
                  Mostrando {Math.min(cuantos, actual.items.length)} de {actual.items.length}
                </p>
                {cuantos < actual.items.length ? (
                  <div className="mt-2">
                    <Boton variante="secundario" ancho={false} onClick={() => setCuantos((c) => c + TRAMO)}>
                      Mostrar más
                    </Boton>
                  </div>
                ) : null}
              </div>
            )}

            {actual.atendidos.length > 0 ? (
              <div>
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                  <CheckCircle2 className="size-4 text-ok" strokeWidth={2.2} aria-hidden="true" /> Ya atendidos ({actual.atendidos.length})
                </h3>
                <ul className="divide-y divide-arena">
                  {actual.atendidos.map((i) => (
                    <li key={i.clave}>
                      <Link href={i.href} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          <span className="block font-semibold">{i.etiqueta}</span>
                          <span className="block text-sm text-humo">{i.detalle}</span>
                          {i.queHacer ? <span className="mt-0.5 block text-sm font-medium">{i.queHacer}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Insignia tono="ok">{i.atendido}</Insignia>
                          <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="group rounded-2xl border border-arena p-3.5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold">
                <span>¿Cómo funciona esta señal?</span>
                <span className="shrink-0 pl-3 font-medium text-humo group-open:hidden">Ver</span>
                <span className="hidden shrink-0 pl-3 font-medium text-humo group-open:inline">Ocultar</span>
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <h3 className="text-sm font-bold">Qué significa</h3>
                  <p className="mt-0.5 text-[0.9375rem] text-humo">{actual.queSignifica}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold">Cuándo se pone en cada color</h3>
                  <p className="mt-0.5 text-[0.9375rem] text-humo">{actual.regla}</p>
                  <Link href="/mas/ajustes" className="mt-1 inline-block text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Cambiar los plazos en Ajustes de la finca
                  </Link>
                </div>
              </div>
            </details>

            {actual.accion ? (
              <Link href={actual.accion.href} className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
                {actual.accion.texto}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
