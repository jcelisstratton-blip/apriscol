"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, GitFork, Sprout, Trophy } from "lucide-react";
import { Escena } from "@/components/TarjetaOpcion";
import { escena, ESCENA_HATO, type EscenaDef } from "@/lib/escenas";

const TARJETAS: { titulo: string; detalle: string; escena: EscenaDef }[] = [
  { titulo: "Cabras", detalle: "Lecheras, de carne o de doble propósito.", escena: ESCENA_HATO.caprino },
  { titulo: "Ovejas", detalle: "Con sus propios parámetros de ceba y monta.", escena: ESCENA_HATO.ovino },
  { titulo: "Genealogía y endogamia", detalle: "El parentesco, antes de cruzar.", escena: escena(GitFork, "musgo", Sprout) },
  { titulo: "Leche", detalle: "Del ordeño al tanque, con su calidad.", escena: ESCENA_HATO.ordeno },
  { titulo: "Reproducción y partos", detalle: "Monta, gestación, partos y crías.", escena: ESCENA_HATO.empadronamiento },
  { titulo: "Carne y ceba", detalle: "Pesos, lotes y rendimiento al sacrificio.", escena: ESCENA_HATO.ceba },
  { titulo: "Sanidad", detalle: "Vacunas, tratamientos y periodos de retiro.", escena: ESCENA_HATO.sanidad },
  { titulo: "Corrales y potreros", detalle: "Cupo, rotación y cuarentena.", escena: ESCENA_HATO.corrales },
  { titulo: "Compras, ventas y costos", detalle: "Lo que compras, lo que vendes y cuánto cuesta cada litro y cada animal.", escena: ESCENA_HATO.gastos },
  { titulo: "Premios y ferias", detalle: "El palmarés de cada animal.", escena: escena(Trophy, "ambar", Crown) },
];

/**
 * «Qué cubre Apriscol» como un slide de tarjetas: en el celular se desliza con el dedo, en el computador con las flechas, el teclado o arrastrando con
 * el mouse. El ajuste de cada tarjeta (`snap`) se suspende mientras se arrastra para que el movimiento sea suave.
 */
export function CarruselCubre() {
  const pista = useRef<HTMLUListElement>(null);
  const arrastre = useRef<{ x: number; inicio: number; movido: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [limites, setLimites] = useState({ inicio: true, fin: false });

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setLimites({ inicio: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const mover = (direccion: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: direccion * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };

  const alBajar = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = pista.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    arrastre.current = { x: e.clientX, inicio: el.scrollLeft, movido: false };
  };
  const alMover = (e: React.PointerEvent<HTMLUListElement>) => {
    const a = arrastre.current;
    const el = pista.current;
    if (!a || !el) return;
    const dx = e.clientX - a.x;
    if (!a.movido && Math.abs(dx) < 5) return;
    if (!a.movido) {
      a.movido = true;
      setArrastrando(true);
    }
    el.scrollLeft = a.inicio - dx;
  };
  const alSoltar = () => {
    if (!arrastre.current) return;
    arrastre.current = null;
    setArrastrando(false);
  };
  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") mover(1);
    if (e.key === "ArrowLeft") mover(-1);
  };

  const flecha = (deshabilitada: boolean) =>
    `grid size-11 place-items-center rounded-full bg-papel ring-1 ring-arena transition ${deshabilitada ? "opacity-35" : "text-musgo hover:bg-arena/60 active:scale-95"}`;

  return (
    <section aria-roledescription="carrusel" aria-label="Qué cubre Apriscol" className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-humo">Cubre todo esto</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => mover(-1)} disabled={limites.inicio} aria-label="Anteriores" className={flecha(limites.inicio)}>
            <ChevronLeft className="size-5" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => mover(1)} disabled={limites.fin} aria-label="Siguientes" className={flecha(limites.fin)}>
            <ChevronRight className="size-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <ul
        ref={pista}
        tabIndex={0}
        onScroll={medir}
        onKeyDown={alTeclear}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerLeave={alSoltar}
        onPointerCancel={alSoltar}
        onDragStart={(e) => e.preventDefault()}
        className={`no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scroll-px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 ${arrastrando ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"} [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)] focus-visible:outline-2 focus-visible:outline-musgo`}
      >
        {TARJETAS.map((t, i) => (
          <li key={t.titulo} aria-label={`${i + 1} de ${TARJETAS.length}`} className="w-[11.5rem] shrink-0 snap-start overflow-hidden rounded-3xl bg-papel ring-1 ring-arena sm:w-[13.5rem]">
            <Escena escena={t.escena} alto="h-24" grande />
            <div className="p-3.5">
              <h3 className="font-display text-lg font-semibold leading-tight">{t.titulo}</h3>
              <p className="mt-1 text-[0.875rem] leading-snug text-humo">{t.detalle}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
