"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEscalable } from "@/components/ListaEscalable";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { nombreTipo } from "@/lib/animal";
import { porcentaje } from "@/lib/endogamia";
import type { Especie, SexoAnimal } from "@/lib/tipos";

export type FilaEndogamia = { animal_id: string; numero_arete: string; nombre: string | null; sexo: SexoAnimal; especie: Especie; f: number };
type Filtro = "umbral" | "todos";

/** Animales con endogamia mayor que cero, de mayor a menor. Llegan ya calculados desde el servidor. */
export function ListaEndogamia({ filas, umbral }: { filas: FilaEndogamia[]; umbral: number }) {
  const [filtro, setFiltro] = useState<Filtro>("umbral");
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const texto = busqueda.toLowerCase();
      const visibles = filas.filter(
        (a) =>
          (filtro === "todos" || a.f >= umbral) &&
          (!texto || a.numero_arete.toLowerCase().includes(texto) || (a.nombre ?? "").toLowerCase().includes(texto)),
      );
      return { filas: visibles.slice(desde, desde + cantidad), total: visibles.length };
    },
    [filas, filtro, busqueda, umbral],
  );

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      <FilaDesplazable>
        <Chip activo={filtro === "umbral"} onClick={() => setFiltro("umbral")}>Sobre el umbral</Chip>
        <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Con endogamia</Chip>
      </FilaDesplazable>
      <ListaEscalable<FilaEndogamia>
        key={`${filtro}|${busqueda}`}
        cargar={cargar}
        clave={(a) => a.animal_id}
        fila={(a) => (
          <Link
            href={`/hato/${a.animal_id}`}
            className="flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena transition active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-base font-bold [overflow-wrap:anywhere]">{a.numero_arete}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {a.nombre ? `${a.nombre} · ` : ""}
                {nombreTipo(a.especie, a.sexo)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-display text-xl font-semibold tabular-nums">{porcentaje(a.f)}</span>
              <NivelEndogamia f={a.f} umbral={umbral} />
            </span>
          </Link>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con ese nombre" descripcion="Prueba con otro número de arete o nombre." />
          ) : filtro === "umbral" ? (
            <EstadoVacio
              icono={<CheckCircle2 strokeWidth={1.5} />}
              titulo="Ningún animal supera el umbral"
              descripcion="Ninguno de tus animales activos tiene una endogamia igual o mayor al umbral de tu finca."
            />
          ) : (
            <EstadoVacio icono={<CheckCircle2 strokeWidth={1.5} />} titulo="Sin endogamia" descripcion="Ninguno de tus animales con pedigrí conocido tiene endogamia." />
          )
        }
      />
    </div>
  );
}
