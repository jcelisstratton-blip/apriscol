"use client";

import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaOcupantes, type Ocupante } from "@/components/ListaOcupantes";
import { Tarjeta } from "@/components/Tarjeta";
import { ETIQUETA_ETAPA, type AvisoMezcla, type Etapa } from "@/lib/etapas";

type Filtro = { clave: string; texto: string; ids: Set<string> };

/**
 * «Etapas en este corral» y «Quiénes están»: tocar una etapa o «Ver…» en un aviso filtra la lista de abajo para ver cuáles animales son. Un solo filtro a la vez;
 * tocarlo de nuevo (o «Todos») lo quita.
 */
export function EtapasCorral({ ocupantes, etapas, avisos, vacio }: { ocupantes: (Ocupante & { etapaClave: Etapa | null })[]; etapas: { etapa: Etapa; n: number }[]; avisos: AvisoMezcla[]; vacio: React.ReactNode }) {
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const alternar = (f: Filtro) => setFiltro((actual) => (actual?.clave === f.clave ? null : f));
  const visibles = filtro ? ocupantes.filter((o) => filtro.ids.has(o.id)) : ocupantes;

  return (
    <>
      {etapas.length > 0 ? (
        <Tarjeta titulo="Etapas en este corral">
          <FilaDesplazable>
            <Chip activo={filtro === null} onClick={() => setFiltro(null)}>
              Todos · {ocupantes.length}
            </Chip>
            {etapas.map((x) => (
              <Chip key={x.etapa} activo={filtro?.clave === `etapa-${x.etapa}`} onClick={() => alternar({ clave: `etapa-${x.etapa}`, texto: ETIQUETA_ETAPA[x.etapa], ids: new Set(ocupantes.filter((o) => o.etapaClave === x.etapa).map((o) => o.id)) })}>
                {x.n} {ETIQUETA_ETAPA[x.etapa].toLowerCase()}
              </Chip>
            ))}
          </FilaDesplazable>
          {avisos.length > 0 ? (
            <div className="mt-3 space-y-2">
              {avisos.map((a) => (
                <Aviso key={a.clave} tipo="atencion">
                  {a.texto}
                  {a.ver && a.ver.ids.length > 0 ? (
                    <button type="button" onClick={() => alternar({ clave: `aviso-${a.clave}`, texto: a.ver!.texto, ids: new Set(a.ver!.ids) })} className="mt-1 block min-h-11 text-left font-semibold underline underline-offset-4">
                      {filtro?.clave === `aviso-${a.clave}` ? "Quitar el filtro" : a.ver.texto}
                    </button>
                  ) : null}
                </Aviso>
              ))}
            </div>
          ) : null}
        </Tarjeta>
      ) : null}
      <Tarjeta titulo={filtro ? `Quiénes están: ${filtro.texto.toLowerCase()} (${visibles.length} de ${ocupantes.length})` : `Quiénes están (${ocupantes.length})`}>
        {ocupantes.length === 0 ? vacio : <ListaOcupantes key={filtro?.clave ?? "todos"} ocupantes={visibles} />}
      </Tarjeta>
    </>
  );
}
