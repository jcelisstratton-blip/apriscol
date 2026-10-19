"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { atajosPara, coincideAtajo, GRUPOS_ATAJO, type TipoAtajo } from "@/lib/atajos";
import type { PlanId, RolFinca } from "@/lib/tipos";

const FILTROS: { valor: "todo" | TipoAtajo; texto: string }[] = [
  { valor: "todo", texto: "Todo" },
  { valor: "registrar", texto: "Registrar" },
  { valor: "ir", texto: "Abrir" },
];

function Contenido({ rol, plan, onCerrar }: { rol: RolFinca; plan: PlanId; onCerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<"todo" | TipoAtajo>("todo");
  const visibles = atajosPara(rol, plan).filter((a) => (filtro === "todo" || a.tipo === filtro) && coincideAtajo(a, texto));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-humo" strokeWidth={1.75} />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca: ordeño, vacuna, compra, venta…"
          aria-label="Buscar qué hacer"
          className="min-h-12 w-full rounded-2xl border border-arena bg-papel pl-12 pr-11 text-base placeholder:text-humo/70 focus:border-musgo focus:outline-none focus:ring-2 focus:ring-musgo/25 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto ? (
          <button type="button" onClick={() => setTexto("")} aria-label="Borrar búsqueda" className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-humo hover:bg-arena">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <div className="flex gap-2" role="group" aria-label="Qué mostrar">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            aria-pressed={filtro === f.valor}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${filtro === f.valor ? "bg-musgo text-sobre-musgo" : "bg-lana text-humo ring-1 ring-arena hover:text-tinta"}`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? <p className="py-8 text-center text-sm text-humo">Nada coincide con «{texto}». Prueba con otra palabra.</p> : null}

      {GRUPOS_ATAJO.map((grupo) => {
        const items = visibles.filter((a) => a.grupo === grupo);
        if (items.length === 0) return null;
        return (
          <section key={grupo} aria-label={grupo}>
            <h3 className="mb-1.5 mt-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ocre">{grupo}</h3>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {items.map((a) => (
                <li key={`${a.tipo}-${a.href}-${a.titulo}`} className="min-w-0">
                  <Link href={a.href} onClick={onCerrar} className="flex min-h-14 items-center gap-3 rounded-2xl bg-lana px-3 hover:bg-arena/70">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${a.tipo === "registrar" ? "bg-ocre/15 text-ocre" : "bg-musgo/12 text-musgo"}`}>
                      <a.Icono className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-tight [overflow-wrap:anywhere]">{a.titulo}</span>
                      <span className="block text-[0.8125rem] leading-snug text-humo [overflow-wrap:anywhere]">{a.detalle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** «Al grano»: un solo toque a lo que haya que hacer o abrir en la app, con buscador. Lo comparten la barra inferior y el menú lateral. */
export function HojaAlGrano({ abierta, onCerrar, rol, plan }: { abierta: boolean; onCerrar: () => void; rol: RolFinca; plan: PlanId }) {
  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="Al grano: ¿qué necesitas?" ancho="max-w-md sm:max-w-2xl">
      <Contenido rol={rol} plan={plan} onCerrar={onCerrar} />
    </Sheet>
  );
}
