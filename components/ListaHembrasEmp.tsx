"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { QuitarDeEmp } from "@/components/AccionesEmpadronamiento";
import { porcentaje } from "@/lib/endogamia";
import { ETIQUETA_ESTADO, TONO_ESTADO, plazoParto } from "@/lib/reproduccion";
import { formatoFecha } from "@/lib/fechas";
import type { EstadoRepro } from "@/lib/tipos";

export type FilaHembraEmp = {
  hembraId: string;
  etiqueta: string;
  machoId: string;
  machoEtiqueta: string;
  endogamia: number;
  /** El semental es de otro hato: no hay genealogía, así que no hay endogamia que mostrar. */
  machoExterno?: boolean;
  excepcion: boolean;
  /** Solo en temporadas cerradas: cómo quedó la hembra después del cierre. */
  estado: EstadoRepro | null;
  prevista: string | null;
};

/** Las hembras de una temporada, con su semental, la endogamia de la pareja y (ya cerrada) su fecha prevista de parto. */
export function ListaHembrasEmp({
  loteId,
  filas,
  machos,
  umbral,
  abierto,
  puedeQuitar,
  hoy,
}: {
  loteId: string;
  filas: FilaHembraEmp[];
  machos: { id: string; etiqueta: string }[];
  umbral: number;
  abierto: boolean;
  puedeQuitar: boolean;
  hoy: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [macho, setMacho] = useState<string>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t.toLowerCase()), []);
  const visibles = filas.filter((f) => (macho === "todos" || f.machoId === macho) && (!busqueda || f.etiqueta.toLowerCase().includes(busqueda)));

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {machos.length > 1 ? (
        <FilaDesplazable>
          <Chip activo={macho === "todos"} onClick={() => setMacho("todos")}>Todos</Chip>
          {machos.map((m) => (
            <Chip key={m.id} activo={macho === m.id} onClick={() => setMacho(m.id)}>{m.etiqueta}</Chip>
          ))}
        </FilaDesplazable>
      ) : null}
      {visibles.length === 0 ? (
        <p className="py-4 text-center text-[0.9375rem] text-humo">{filas.length === 0 ? "Todavía no hay hembras en esta temporada." : "Ninguna coincide."}</p>
      ) : (
        <ListaPorTramos
          key={`${macho}|${busqueda}`}
          items={visibles}
          clave={(f) => f.hembraId}
          fila={(f) => (
            <div className="flex items-center gap-2 rounded-2xl bg-papel py-2 pl-3.5 pr-1.5 ring-1 ring-arena">
              <Link href={`/hato/${f.hembraId}#reproduccion`} className="min-w-0 flex-1 py-1">
                <span className="block font-semibold [overflow-wrap:anywhere]">{f.etiqueta}</span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">con {f.machoEtiqueta}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  {f.machoExterno ? (
                    <span className="text-xs text-humo">Semental de otro hato: sin dato de endogamia</span>
                  ) : (
                    <>
                      <NivelEndogamia f={f.endogamia} umbral={umbral} />
                      <span className="text-xs text-humo">Endogamia {porcentaje(f.endogamia)}</span>
                    </>
                  )}
                  {f.excepcion ? <Insignia tono="alerta">Excepción</Insignia> : null}
                  {f.estado ? <Insignia tono={TONO_ESTADO[f.estado]}>{ETIQUETA_ESTADO[f.estado]}</Insignia> : null}
                  {f.prevista ? (
                    <Insignia tono={plazoParto(f.prevista, hoy).tono}>
                      Parto {formatoFecha(f.prevista, { day: "numeric", month: "short" })} · {plazoParto(f.prevista, hoy).texto}
                    </Insignia>
                  ) : null}
                </span>
              </Link>
              {abierto && puedeQuitar ? <QuitarDeEmp loteId={loteId} animalId={f.hembraId} tipo="hembra" nombre={f.etiqueta} /> : null}
            </div>
          )}
        />
      )}
    </div>
  );
}
