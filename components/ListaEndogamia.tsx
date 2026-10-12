"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEscalable } from "@/components/ListaEscalable";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { OrigenEndogamia } from "@/components/OrigenEndogamia";
import { nombreTipo } from "@/lib/animal";
import { porcentaje } from "@/lib/endogamia";
import type { Especie, SexoAnimal } from "@/lib/tipos";

export type FilaEndogamia = { animal_id: string; numero_arete: string; nombre: string | null; sexo: SexoAnimal; especie: Especie; f: number };
type Filtro = "umbral" | "bajo" | "todos";

function FilaEndogamiaAnimal({ a, umbral }: { a: FilaEndogamia; umbral: number }) {
  const [abierta, setAbierta] = useState(false);
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
          <NivelEndogamia f={a.f} umbral={umbral} />
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-arena px-3.5 text-sm font-semibold text-musgo"
      >
        {a.f >= umbral ? "¿Por qué tiene endogamia alta?" : "¿De dónde viene esta endogamia?"}
        <ChevronDown className={`size-4 transition ${abierta ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
      </button>
      {abierta ? (
        <div className="border-t border-arena p-3.5">
          <OrigenEndogamia animalId={a.animal_id} />
        </div>
      ) : null}
    </article>
  );
}

/** Animales con endogamia mayor que cero, de mayor a menor. Llegan ya calculados desde el servidor. Se pueden ver los que están sobre el umbral de la finca, los que están por debajo (aceptables) o todos. */
export function ListaEndogamia({ filas, umbral }: { filas: FilaEndogamia[]; umbral: number }) {
  const [filtro, setFiltro] = useState<Filtro>("umbral");
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const texto = busqueda.toLowerCase();
      const visibles = filas.filter(
        (a) =>
          (filtro === "todos" || (filtro === "umbral" ? a.f >= umbral : a.f < umbral)) &&
          (!texto || a.numero_arete.toLowerCase().includes(texto) || (a.nombre ?? "").toLowerCase().includes(texto)),
      );
      return { filas: visibles.slice(desde, desde + cantidad), total: visibles.length };
    },
    [filas, filtro, busqueda, umbral],
  );

  const sobre = filas.filter((a) => a.f >= umbral).length;
  const bajo = filas.length - sobre;
  const DEFINICION: Record<Filtro, string> = {
    umbral: `Endogamia igual o mayor al umbral de tu finca (${porcentaje(umbral)}). Conviene evitar repetir esas cruzas.`,
    bajo: `Tienen algo de endogamia, pero por debajo de tu umbral (${porcentaje(umbral)}): es un nivel aceptable. «A vigilar» marca los que ya se acercan.`,
    todos: "Todos los animales con algo de endogamia, de la más alta a la más baja.",
  };

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      <FilaDesplazable>
        <Chip activo={filtro === "umbral"} onClick={() => setFiltro("umbral")}>Sobre el umbral · {sobre}</Chip>
        <Chip activo={filtro === "bajo"} onClick={() => setFiltro("bajo")}>Bajo el umbral · {bajo}</Chip>
        <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos con endogamia · {filas.length}</Chip>
      </FilaDesplazable>
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
          ) : filtro === "bajo" ? (
            <EstadoVacio
              icono={<CheckCircle2 strokeWidth={1.5} />}
              titulo="Ningún animal con endogamia bajo el umbral"
              descripcion="Los animales que tienen algo de endogamia ya están sobre el umbral de tu finca."
            />
          ) : (
            <EstadoVacio icono={<CheckCircle2 strokeWidth={1.5} />} titulo="Sin endogamia" descripcion="Ninguno de tus animales con pedigrí conocido tiene endogamia." />
          )
        }
      />
    </div>
  );
}
