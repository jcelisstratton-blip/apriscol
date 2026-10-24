"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Droplets } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { ChipsTurnos } from "@/components/ChipsTurnos";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useToast } from "@/components/Toast";
import { programarOrdeno, programarOrdenoLote } from "@/app/(app)/hato/actions";
import { ETIQUETA_TURNO, TURNOS, turnosDe, type Turno } from "@/lib/ordeno";
import { sinTildes } from "@/lib/texto";

export type HembraEnLeche = { id: string; etiqueta: string; turnos: string[] | null };

const MIN_PARA_BUSCAR = 8;

/**
 * El programa del ordeño: qué hembras en leche se ordeñan y en qué turnos (mañana, tarde, noche). Cada toque se guarda al instante, y de
 * esto sale la lista de cada turno al registrar el ordeño en Leche. Arriba, atajos para prender o apagar un turno en todas.
 */
export function ProgramaOrdeno({ hembras, puedeEditar }: { hembras: HembraEnLeche[]; puedeEditar: boolean }) {
  const toast = useToast();
  const [turnos, setTurnos] = useState<Record<string, Turno[]>>(() => Object.fromEntries(hembras.map((h) => [h.id, turnosDe(h.turnos)])));
  const [busqueda, setBusqueda] = useState("");
  const [, iniciar] = useTransition();
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cuantas = useMemo(
    () => Object.fromEntries(TURNOS.map((t) => [t, hembras.filter((h) => turnos[h.id]?.includes(t)).length])) as Record<Turno, number>,
    [hembras, turnos],
  );
  const sinTurno = hembras.filter((h) => (turnos[h.id] ?? []).length === 0).length;

  const cambiarUna = (id: string, nuevos: Turno[]) => {
    const anteriores = turnos[id];
    setTurnos((t) => ({ ...t, [id]: nuevos }));
    iniciar(async () => {
      const r = await programarOrdeno(id, nuevos);
      if (!r.ok) {
        setTurnos((t) => ({ ...t, [id]: anteriores }));
        toast.error(r.error);
      }
    });
  };

  const cambiarTodas = (turno: Turno) => {
    const activar = cuantas[turno] < hembras.length;
    const anteriores = turnos;
    setTurnos((t) => Object.fromEntries(Object.entries(t).map(([id, ts]) => [id, TURNOS.filter((x) => (x === turno ? activar : ts.includes(x)))])));
    iniciar(async () => {
      const r = await programarOrdenoLote(turno, activar);
      if (!r.ok) {
        setTurnos(anteriores);
        toast.error(r.error);
      } else {
        toast.exito(activar ? `${ETIQUETA_TURNO[turno]}: todas las hembras en leche` : `${ETIQUETA_TURNO[turno]}: ninguna hembra`);
      }
    });
  };

  if (hembras.length === 0) {
    return (
      <EstadoVacio
        icono={<Droplets strokeWidth={1.5} />}
        titulo="Aún no hay hembras en leche"
        descripcion="Aquí programas en qué turnos se ordeña cada hembra en leche. Primero agrega las hembras al ordeño."
      />
    );
  }

  const texto = sinTildes(busqueda);
  const filtradas = texto ? hembras.filter((h) => sinTildes(h.etiqueta).includes(texto)) : hembras;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-3xl bg-papel p-4 ring-1 ring-arena">
        <div>
          <p className="font-semibold">Para todas las hembras en leche ({hembras.length})</p>
          <p className="text-sm text-humo">Prende o apaga un turno en todas a la vez. Después ajustas una por una.</p>
        </div>
        <div role="group" aria-label="Turnos de todas las hembras" className="grid grid-cols-3 gap-1.5">
          {TURNOS.map((t) => {
            const todas = cuantas[t] === hembras.length;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={todas}
                disabled={!puedeEditar}
                onClick={() => cambiarTodas(t)}
                className={`min-h-14 min-w-0 rounded-2xl px-2 py-1.5 text-center transition disabled:opacity-60 ${todas ? "bg-musgo text-sobre-musgo" : "bg-lana ring-1 ring-arena"}`}
              >
                <span className="block text-sm font-semibold">{ETIQUETA_TURNO[t]}</span>
                <span className={`block text-xs ${todas ? "opacity-85" : "text-humo"}`}>
                  {cuantas[t]} de {hembras.length}
                </span>
              </button>
            );
          })}
        </div>
        {sinTurno > 0 ? <p className="text-sm text-humo">{sinTurno} {sinTurno === 1 ? "hembra no se ordeña" : "hembras no se ordeñan"} en ningún turno por ahora.</p> : null}
        {puedeEditar ? null : <p className="text-sm text-humo">Solo el propietario o un administrador puede cambiar el programa.</p>}
      </div>

      {hembras.length > MIN_PARA_BUSCAR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {filtradas.length === 0 ? (
        <p className="py-6 text-center text-[0.9375rem] text-humo">Ninguna hembra coincide.</p>
      ) : (
        <ListaPorTramos
          key={texto}
          items={filtradas}
          clave={(h) => h.id}
          tramo={20}
          fila={(h) => (
            <div className="space-y-2.5 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
              <Link href={`/hato/${h.id}`} className="block min-w-0 font-bold [overflow-wrap:anywhere] hover:underline">
                {h.etiqueta}
              </Link>
              <ChipsTurnos valor={turnos[h.id] ?? []} onCambio={(n) => cambiarUna(h.id, n)} deshabilitado={!puedeEditar} etiqueta={`Turnos de ${h.etiqueta}`} />
            </div>
          )}
        />
      )}
    </div>
  );
}
