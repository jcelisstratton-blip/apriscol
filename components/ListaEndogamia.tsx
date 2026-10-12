"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_FILTRO_ENDOGAMIA } from "@/lib/escenas-listas-genealogia";
import { textoAnimales } from "@/lib/hato";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { OrigenEndogamia } from "@/components/OrigenEndogamia";
import { nombreTipo } from "@/lib/animal";
import { nivelEndogamia, porcentaje, repartirPorNivel } from "@/lib/endogamia";
import type { Especie, SexoAnimal } from "@/lib/tipos";

export type FilaEndogamia = { animal_id: string; numero_arete: string; nombre: string | null; sexo: SexoAnimal; especie: Especie; f: number };
type Filtro = "umbral" | "vigilar" | "aceptables" | "todos";

function FilaEndogamiaAnimal({ a, umbral }: { a: FilaEndogamia; umbral: number }) {
  const [abierta, setAbierta] = useState(false);
  const sin = a.f <= 0;
  const alta = nivelEndogamia(a.f, umbral) === "alto" || nivelEndogamia(a.f, umbral) === "muy_alto";
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl bg-papel ring-1 ring-arena">
      <Link href={`/hato/${a.animal_id}`} className="flex min-h-[4.25rem] items-center justify-between gap-3 px-3.5 py-2.5 transition active:bg-arena/40">
        <span className="min-w-0">
          <span className="block text-base font-bold [overflow-wrap:anywhere]">{a.numero_arete}</span>
          <span className="block text-sm text-humo [overflow-wrap:anywhere]">
            {a.nombre ? `${a.nombre} · ` : ""}
            {nombreTipo(a.especie, a.sexo)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-xl font-semibold tabular-nums">{porcentaje(a.f)}</span>
          {sin ? <Insignia tono="ok">Sin endogamia</Insignia> : <NivelEndogamia f={a.f} umbral={umbral} />}
        </span>
      </Link>
      {sin ? null : (
        <>
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-arena px-3.5 text-sm font-semibold text-musgo"
          >
            {alta ? "¿Por qué tiene endogamia alta?" : "¿De dónde viene esta endogamia?"}
            <ChevronDown className={`size-4 transition ${abierta ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
          </button>
          {abierta ? (
            <div className="border-t border-arena p-3.5">
              <OrigenEndogamia animalId={a.animal_id} />
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

/**
 * Los animales medidos de la finca, de mayor a menor endogamia, en tres grupos que suman el total: sobre el umbral, a vigilar y aceptables
 * (los aceptables incluyen a los que no tienen endogamia). Llegan ya calculados desde el servidor.
 */
export function ListaEndogamia({ filas, umbral }: { filas: FilaEndogamia[]; umbral: number }) {
  const [filtro, setFiltro] = useState<Filtro>("umbral");
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const texto = busqueda.toLowerCase();
      const visibles = filas.filter((a) => {
        const nivel = nivelEndogamia(a.f, umbral);
        const delFiltro =
          filtro === "todos" ||
          (filtro === "umbral" && (nivel === "alto" || nivel === "muy_alto")) ||
          (filtro === "vigilar" && nivel === "vigilar") ||
          (filtro === "aceptables" && nivel === "bajo");
        return delFiltro && (!texto || a.numero_arete.toLowerCase().includes(texto) || (a.nombre ?? "").toLowerCase().includes(texto));
      });
      return { filas: visibles.slice(desde, desde + cantidad), total: visibles.length };
    },
    [filas, filtro, busqueda, umbral],
  );

  const r = repartirPorNivel(filas.map((a) => a.f), umbral);
  const DEFINICION: Record<Filtro, string> = {
    umbral: `Endogamia desde el umbral de tu finca (${porcentaje(umbral)}). Conviene evitar repetir esas cruzas.`,
    vigilar: `Desde ${porcentaje(umbral / 2)} hasta menos de ${porcentaje(umbral)}: todavía bajo el umbral, pero ya se acercan. Conviene vigilarlos.`,
    aceptables: `Menos de ${porcentaje(umbral / 2)}, incluidos los que no tienen endogamia: nivel aceptable.`,
    todos: "Todos los animales medidos, de la endogamia más alta a la más baja.",
  };

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      <FilaTarjetas etiqueta="Nivel de endogamia">
        <TarjetaOpcion escena={ESCENA_FILTRO_ENDOGAMIA.umbral} titulo="Sobre el umbral" dato={textoAnimales(r.sobre)} activo={filtro === "umbral"} onClick={() => setFiltro("umbral")} />
        <TarjetaOpcion escena={ESCENA_FILTRO_ENDOGAMIA.vigilar} titulo="A vigilar" dato={textoAnimales(r.vigilar)} activo={filtro === "vigilar"} onClick={() => setFiltro("vigilar")} />
        <TarjetaOpcion escena={ESCENA_FILTRO_ENDOGAMIA.aceptables} titulo="Aceptables" dato={textoAnimales(r.aceptables)} activo={filtro === "aceptables"} onClick={() => setFiltro("aceptables")} />
        <TarjetaOpcion escena={ESCENA_FILTRO_ENDOGAMIA.todos} titulo="Todos" dato={textoAnimales(filas.length)} activo={filtro === "todos"} onClick={() => setFiltro("todos")} />
      </FilaTarjetas>
      <p className="px-1 text-sm text-humo" aria-live="polite">{DEFINICION[filtro]}</p>
      <ListaEscalable<FilaEndogamia>
        key={`${filtro}|${busqueda}`}
        cargar={cargar}
        clave={(a) => a.animal_id}
        fila={(a) => <FilaEndogamiaAnimal a={a} umbral={umbral} />}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con ese nombre" descripcion="Prueba con otro número de arete o nombre." />
          ) : filtro === "umbral" ? (
            <EstadoVacio
              icono={<CheckCircle2 strokeWidth={1.5} />}
              titulo="Ningún animal supera el umbral"
              descripcion="Ninguno de tus animales activos tiene una endogamia igual o mayor al umbral de tu finca."
            />
          ) : filtro === "vigilar" ? (
            <EstadoVacio icono={<CheckCircle2 strokeWidth={1.5} />} titulo="Ningún animal por vigilar" descripcion="No hay animales cerca del umbral de tu finca." />
          ) : filtro === "aceptables" ? (
            <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Ningún animal aceptable" descripcion="Todos los animales medidos están sobre el umbral o cerca de él." />
          ) : (
            <EstadoVacio icono={<CheckCircle2 strokeWidth={1.5} />} titulo="Sin animales medidos" descripcion="Cuando tus animales tengan padre y madre registrados, aparecerán aquí." />
          )
        }
      />
    </div>
  );
}
