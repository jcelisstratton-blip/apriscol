"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { DefinirCobertura } from "@/components/DefinirCobertura";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { ordenarPorUrgencia, textoPlazo } from "@/lib/esquila";
import type { OvejaEsquila } from "@/lib/esquila-servidor";
import { sinTildes } from "@/lib/texto";

type Filtro = "pendientes" | "al_dia" | "pelo" | "por_definir";

const TEXTO_VACIO: Record<Filtro, string> = {
  pendientes: "Ninguna oveja de lana necesita esquila por ahora.",
  al_dia: "Todavía no hay ovejas de lana con la esquila al día.",
  pelo: "No hay ovejas de pelo.",
  por_definir: "No hay ovejas por definir.",
};

const estaPendiente = (o: OvejaEsquila) => o.cobertura === "lana" && o.plazo !== null && o.plazo.estado !== "al_dia";

/** Las ovejas activas con lo que pide cada una: las de lana por su plazo, las de pelo (no se esquilan) y las que falta definir. */
export function ListaOvejasEsquila({ ovejas, puedeEditar = false }: { ovejas: OvejaEsquila[]; puedeEditar?: boolean }) {
  const cuenta = useMemo(
    () => ({
      pendientes: ovejas.filter(estaPendiente).length,
      al_dia: ovejas.filter((o) => o.cobertura === "lana" && !estaPendiente(o)).length,
      pelo: ovejas.filter((o) => o.cobertura === "pelo").length,
      por_definir: ovejas.filter((o) => o.cobertura === "por_definir").length,
    }),
    [ovejas],
  );
  const [filtro, setFiltro] = useState<Filtro>(cuenta.pendientes > 0 || ovejas.length === 0 ? "pendientes" : cuenta.por_definir > 0 ? "por_definir" : "al_dia");
  const [busqueda, setBusqueda] = useState("");

  const filas = useMemo(() => {
    const q = sinTildes(busqueda.toLowerCase());
    const base =
      filtro === "pendientes" ? ovejas.filter(estaPendiente)
      : filtro === "al_dia" ? ovejas.filter((o) => o.cobertura === "lana" && !estaPendiente(o))
      : ovejas.filter((o) => o.cobertura === filtro);
    const buscadas = q ? base.filter((o) => sinTildes(`${o.numero_arete} ${o.nombre ?? ""}`.toLowerCase()).includes(q)) : base;
    return filtro === "pendientes" || filtro === "al_dia" ? ordenarPorUrgencia(buscadas) : buscadas;
  }, [ovejas, filtro, busqueda]);

  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: filas.slice(desde, desde + cantidad), total: filas.length }), [filas]);

  const chips: [Filtro, string][] = [
    ["pendientes", "Por esquilar"],
    ["al_dia", "Al día"],
    ["pelo", "De pelo"],
    ["por_definir", "Por definir"],
  ];

  return (
    <div className="space-y-3">
      <FilaDesplazable>
        {chips.map(([valor, texto]) => (
          <Chip key={valor} activo={filtro === valor} onClick={() => setFiltro(valor)}>
            {texto} · {cuenta[valor]}
          </Chip>
        ))}
      </FilaDesplazable>
      {ovejas.length > 8 ? <CampoBusqueda onBuscar={setBusqueda} placeholder="Buscar por arete o nombre" /> : null}
      {filtro === "por_definir" && puedeEditar && filas.length > 0 ? (
        <DefinirCobertura key={busqueda} ovejas={filas} />
      ) : (
      <ListaEscalable<OvejaEsquila>
        key={`${filtro}|${busqueda}`}
        cargar={cargar}
        clave={(o) => o.id}
        vacio={<p className="px-2 py-8 text-center text-[0.9375rem] text-humo">{busqueda ? "Ninguna oveja coincide con la búsqueda." : TEXTO_VACIO[filtro]}</p>}
        fila={(o) => (
          <Link href={`/hato/${o.id}#esquila`} className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-2xl bg-papel px-4 py-3 ring-1 ring-arena transition hover:bg-arena/40">
            <span className="min-w-0">
              <span className="block font-semibold [overflow-wrap:anywhere]">{o.numero_arete}</span>
              {o.nombre ? <span className="block text-sm text-humo [overflow-wrap:anywhere]">{o.nombre}</span> : null}
            </span>
            <span className="shrink-0 text-right">
              {o.cobertura === "lana" && o.plazo ? (
                <Insignia tono={o.plazo.estado === "atrasada" ? "alerta" : o.plazo.estado === "toca" ? "aviso" : o.plazo.estado === "al_dia" ? "ok" : "neutro"}>{textoPlazo(o.plazo)}</Insignia>
              ) : o.cobertura === "pelo" ? (
                <Insignia>No se esquila</Insignia>
              ) : (
                <Insignia tono="aviso">Por definir</Insignia>
              )}
            </span>
          </Link>
        )}
      />
      )}
    </div>
  );
}
