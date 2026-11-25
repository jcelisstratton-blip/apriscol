"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarCheck, ChevronLeft, ChevronRight, Crown, GitFork, Scissors, Sprout, Trophy } from "lucide-react";
import { BotonPausaMovimiento } from "@/components/BotonPausaMovimiento";
import { Escena } from "@/components/TarjetaOpcion";
import { useArrastrarParaDesplazar } from "@/lib/arrastrar-para-desplazar";
import { useDesplazamientoContinuo } from "@/lib/desplazamiento-continuo";
import { escena, ESCENA_HATO, type EscenaDef } from "@/lib/escenas";
import { ESCENA_TODOS_INVENTARIO } from "@/lib/escenas-inventario";

const TARJETAS: { titulo: string; detalle: string; escena: EscenaDef }[] = [
  { titulo: "Cabras", detalle: "Lecheras, de carne o de doble propósito.", escena: ESCENA_HATO.caprino },
  { titulo: "Ovejas", detalle: "Con sus propios parámetros de ceba y monta.", escena: ESCENA_HATO.ovino },
  { titulo: "Esquila", detalle: "Solo las ovejas de lana, con aviso de cuándo toca.", escena: escena(Scissors, "ambar", CalendarCheck) },
  { titulo: "Semáforos", detalle: "Qué pide atención hoy, en rojo, ámbar o verde, y qué hacer.", escena: escena(Activity, "musgo", CalendarCheck) },
  { titulo: "Genealogía y endogamia", detalle: "El parentesco, antes de cruzar.", escena: escena(GitFork, "musgo", Sprout) },
  { titulo: "Leche", detalle: "Del ordeño al tanque, con su calidad.", escena: ESCENA_HATO.ordeno },
  { titulo: "Reproducción y partos", detalle: "Monta, gestación, partos y crías.", escena: ESCENA_HATO.empadronamiento },
  { titulo: "Carne y ceba", detalle: "Pesos, lotes y rendimiento al sacrificio.", escena: ESCENA_HATO.ceba },
  { titulo: "Sanidad", detalle: "Vacunas, tratamientos y periodos de retiro.", escena: ESCENA_HATO.sanidad },
  { titulo: "Corrales y potreros", detalle: "Cupo, rotación y cuarentena.", escena: ESCENA_HATO.corrales },
  { titulo: "Inventario de bodega", detalle: "Medicamentos y vacunas por lote, y el alimento en kg.", escena: ESCENA_TODOS_INVENTARIO },
  { titulo: "Compras, ventas y costos", detalle: "Lo que compras, lo que vendes y cuánto cuesta cada litro y cada animal.", escena: ESCENA_HATO.gastos },
  { titulo: "Premios y ferias", detalle: "El palmarés de cada animal.", escena: escena(Trophy, "ambar", Crown) },
];

/**
 * «Qué cubre Apriscol» como un slide de tarjetas que se desliza solo, despacio y sin parar (`useDesplazamientoContinuo`): se detiene con el mouse
 * encima, al tocarlo o con el botón de pausa, y al llegar al final sigue con la primera tarjeta. En el celular también se desliza con el dedo; en el
 * computador, con las flechas, el teclado o arrastrando con el mouse. Con «Reducir movimiento» queda quieto, con su ajuste por tarjeta (`snap`).
 */
export function CarruselCubre() {
  const { ref: pista, arrastrando, props: arrastre } = useArrastrarParaDesplazar<HTMLUListElement>();
  const { continuo, pausado, alternarPausa, avanzar } = useDesplazamientoContinuo(pista);
  const [limites, setLimites] = useState({ inicio: true, fin: false });

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setLimites({ inicio: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, [pista]);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") avanzar(1);
    if (e.key === "ArrowLeft") avanzar(-1);
  };

  // En movimiento continuo la fila da la vuelta: las flechas nunca se apagan.
  const inicio = !continuo && limites.inicio;
  const fin = !continuo && limites.fin;
  const flecha = (deshabilitada: boolean) =>
    `group grid size-11 place-items-center rounded-full bg-papel ring-1 ring-arena transition ${deshabilitada ? "opacity-35" : "text-musgo hover:bg-arena/60 active:scale-95"}`;
  const ajuste = arrastrando ? "cursor-grabbing select-none" : continuo && !pausado ? "cursor-grab" : "cursor-grab snap-x snap-mandatory scroll-smooth";
  const copias = continuo ? [false, true] : [false];

  return (
    <section aria-roledescription="carrusel" aria-label="Qué cubre Apriscol" className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-humo">Cubre todo esto</p>
        <div className="flex gap-2">
          {continuo ? <BotonPausaMovimiento pausado={pausado} onClick={alternarPausa} /> : null}
          <button type="button" onClick={() => avanzar(-1)} disabled={inicio} aria-label="Anteriores" className={flecha(inicio)}>
            <ChevronLeft className="size-5 transition-[translate] duration-200 group-hover:-translate-x-0.5" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => avanzar(1)} disabled={fin} aria-label="Siguientes" className={flecha(fin)}>
            <ChevronRight className="size-5 transition-[translate] duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <ul
        ref={pista}
        tabIndex={0}
        onScroll={medir}
        onKeyDown={alTeclear}
        {...arrastre}
        className={`no-scrollbar relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 scroll-px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 ${ajuste} [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)] focus-visible:outline-2 focus-visible:outline-musgo`}
      >
        {copias.flatMap((copia) =>
          TARJETAS.map((t, i) => (
            <li
              key={`${copia ? "copia-" : ""}${t.titulo}`}
              data-copia={copia && i === 0 ? "" : undefined}
              aria-hidden={copia || undefined}
              inert={copia || undefined}
              aria-label={copia ? undefined : `${i + 1} de ${TARJETAS.length}`}
              className="w-[11.5rem] shrink-0 snap-start overflow-hidden rounded-3xl bg-papel ring-1 ring-arena transition duration-300 ease-[var(--ease-salida)] hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-18px_rgba(60,45,20,0.45)] hover:ring-musgo/30 sm:w-[13.5rem]"
            >
              <Escena escena={t.escena} alto="h-24" grande />
              <div className="p-3.5">
                <h3 className="font-display text-lg font-semibold leading-tight">{t.titulo}</h3>
                <p className="mt-1 text-[0.875rem] leading-snug text-humo">{t.detalle}</p>
              </div>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
