"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Scale, TriangleAlert } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { ETIQUETA_NIVEL, type GrupoCandidatos, type TextoAdvertencia } from "@/lib/ceba-candidatos";
import type { NivelCeba, SexoAnimal } from "@/lib/tipos";

export type FilaCandidato = {
  id: string;
  etiqueta: string;
  sexo: SexoAnimal;
  nivel: NivelCeba;
  /** Edad y, si se sabe, partos: «8 años · 7 partos». */
  detalle: string;
  motivos: string[];
  advertencias: TextoAdvertencia[];
  /** Último peso, o nulo si no tiene. */
  peso: string | null;
};

const TONO_ADVERTENCIA = { aviso: "text-ambar", alerta: "text-rojo", neutro: "text-humo" } as const;

/** Los animales que conviene pasar a ceba: primero los que ya les toca. Cada fila lleva a la ficha, donde se decide. */
export function ListaCandidatos({ filas }: { filas: FilaCandidato[] }) {
  const [grupo, setGrupo] = useState<GrupoCandidatos>("todos");
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const nHembras = filas.filter((f) => f.sexo === "hembra").length;
  const nMachos = filas.length - nHembras;
  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase();
    return filas.filter((f) => (grupo === "todos" || (grupo === "hembras" ? f.sexo === "hembra" : f.sexo === "macho")) && (!q || f.etiqueta.toLowerCase().includes(q)));
  }, [filas, grupo, busqueda]);

  return (
    <div className="space-y-3">
      {nHembras > 0 && nMachos > 0 ? (
        <FilaDesplazable>
          <Chip activo={grupo === "todos"} onClick={() => setGrupo("todos")}>Todos ({filas.length})</Chip>
          <Chip activo={grupo === "hembras"} onClick={() => setGrupo("hembras")}>Hembras ({nHembras})</Chip>
          <Chip activo={grupo === "machos"} onClick={() => setGrupo("machos")}>Machos ({nMachos})</Chip>
        </FilaDesplazable>
      ) : null}
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {visibles.length === 0 ? (
        <EstadoVacio icono={<Scale strokeWidth={1.5} />} titulo="Ningún animal coincide" descripcion="Prueba con otro filtro o con otro arete o nombre." />
      ) : (
        <ListaPorTramos
          key={`${grupo}|${busqueda}`}
          items={visibles}
          clave={(f) => f.id}
          fila={(f) => (
            <Link href={`/hato/${f.id}#crecimiento`} className="flex items-start gap-2 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition hover:ring-musgo/40">
              <span className="block min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-bold [overflow-wrap:anywhere]">{f.etiqueta}</span>
                  <span className="shrink-0 whitespace-nowrap">
                    <Insignia tono={f.nivel === "toca" ? "alerta" : "aviso"}>{ETIQUETA_NIVEL[f.nivel]}</Insignia>
                  </span>
                </span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                  {f.sexo === "hembra" ? "Hembra" : "Macho"} · {f.detalle}
                </span>
                {f.motivos.map((m) => (
                  <span key={m} className="mt-1 block text-[0.9375rem] [overflow-wrap:anywhere]">{m}</span>
                ))}
                {f.advertencias.map((a) => (
                  <span key={a.codigo} className={`mt-1 flex items-start gap-1.5 text-sm ${TONO_ADVERTENCIA[a.tono]}`}>
                    {a.tono === "neutro" ? null : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
                    <span className="min-w-0 [overflow-wrap:anywhere]">{a.texto}</span>
                  </span>
                ))}
                {f.peso ? <span className="mt-1 block text-sm text-humo [overflow-wrap:anywhere]">{f.peso}</span> : null}
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-humo" strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        />
      )}
    </div>
  );
}
