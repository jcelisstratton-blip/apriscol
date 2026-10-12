"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { avanceMeta, conversion, gdp, kg, textoConversion } from "@/lib/carne";
import { formatoFecha } from "@/lib/fechas";

export type FilaLote = {
  id: string;
  nombre: string;
  fechaInicio: string;
  cerradoEn: string | null;
  pesoMeta: number | null;
  animales: number;
  pesoPromedio: number | null;
  gdpG: number | null;
  kgGanados: number;
  kgAlimento: number;
  listos: number;
};

type Filtro = "abiertos" | "cerrados";

/** Los lotes de ceba de la finca con lo que lleva cada uno. Abiertos primero; los cerrados quedan de historial. */
export function ListaLotes({ lotes, puedeEditar }: { lotes: FilaLote[]; puedeEditar: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>("abiertos");
  const abiertos = lotes.filter((l) => !l.cerradoEn);
  const cerrados = lotes.filter((l) => l.cerradoEn);
  const visibles = filtro === "abiertos" ? abiertos : cerrados;

  if (lotes.length === 0) {
    return (
      <EstadoVacio icono={<Layers strokeWidth={1.5} />} titulo="Aún no hay lotes de ceba" descripcion="Un lote es el grupo de animales que engordas juntos. Con él ves cuánto ganan, cuánto comen y cuándo están listos.">
        {puedeEditar ? <EnlaceBoton href="/carne/lotes/nuevo">Crear un lote</EnlaceBoton> : null}
      </EstadoVacio>
    );
  }

  return (
    <div className="space-y-3">
      <FilaDesplazable>
        <Chip activo={filtro === "abiertos"} onClick={() => setFiltro("abiertos")}>{`Abiertos (${abiertos.length})`}</Chip>
        <Chip activo={filtro === "cerrados"} onClick={() => setFiltro("cerrados")}>{`Cerrados (${cerrados.length})`}</Chip>
      </FilaDesplazable>
      {visibles.length === 0 ? (
        <p className="py-6 text-center text-[0.9375rem] text-humo">{filtro === "abiertos" ? "No tienes lotes abiertos." : "Todavía no has cerrado ningún lote."}</p>
      ) : (
        <ListaPorTramos
          key={filtro}
          items={visibles}
          clave={(l) => l.id}
          fila={(l) => {
            const avance = avanceMeta(l.pesoPromedio, l.pesoMeta);
            return (
              <Link href={`/carne/lotes/${l.id}`} className="block space-y-2 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition active:scale-[0.99]">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold [overflow-wrap:anywhere]">{l.nombre}</span>
                    <span className="block text-sm text-humo">
                      Desde el {formatoFecha(l.fechaInicio)} · {l.animales} {l.animales === 1 ? "animal" : "animales"}
                      {l.cerradoEn ? ` · cerrado el ${formatoFecha(l.cerradoEn)}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-humo" aria-hidden="true" />
                </span>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Peso promedio", kg(l.pesoPromedio)],
                    ["Ganancia", gdp(l.gdpG)],
                    ["Conversión", textoConversion(conversion(l.kgAlimento, l.kgGanados))],
                  ].map(([e, v]) => (
                    <div key={e} className="min-w-0 rounded-xl bg-lana px-1 py-2">
                      <dd className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">{v}</dd>
                      <dt className="text-[0.6875rem] font-medium text-humo">{e}</dt>
                    </div>
                  ))}
                </dl>
                {avance !== null ? (
                  <span className="block space-y-1">
                    <span className="flex items-center justify-between gap-2 text-xs text-humo">
                      <span>Meta {kg(l.pesoMeta)}</span>
                      {l.listos > 0 ? <Insignia tono="ok">{`${l.listos} ${l.listos === 1 ? "listo" : "listos"}`}</Insignia> : <span>{avance} %</span>}
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-arena" aria-hidden="true">
                      <span className="block h-full rounded-full bg-musgo" style={{ width: `${avance}%` }} />
                    </span>
                  </span>
                ) : null}
              </Link>
            );
          }}
        />
      )}
    </div>
  );
}
