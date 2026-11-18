"use client";

import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEscalable } from "@/components/ListaEscalable";
import { registrarEsquila } from "@/app/(app)/esquila/actions";
import { sinTildes } from "@/lib/texto";

export type OvejaElegible = { id: string; numero_arete: string; nombre: string | null; /** «Le toca hoy», «Atrasada 40 días»… */ texto: string; /** Le toca (o nunca se ha esquilado): se puede elegir en grupo. */ pendiente: boolean };

/** Registrar una esquila: la fecha, quién esquiló y las ovejas de lana esquiladas, con los kilos de vellón de cada una (opcional). */
export function FormEsquila({ ovejas, inicial, solicitud, hoy }: { ovejas: OvejaElegible[]; inicial: string[]; solicitud: string; hoy: string }) {
  const [estado, enviar, pendiente] = useActionState(registrarEsquila, undefined);
  const [, iniciar] = useTransition();
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(inicial.filter((id) => ovejas.some((o) => o.id === id))));
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");

  const filas = useMemo(() => {
    const q = sinTildes(busqueda.toLowerCase());
    return q ? ovejas.filter((o) => sinTildes(`${o.numero_arete} ${o.nombre ?? ""}`.toLowerCase()).includes(q)) : ovejas;
  }, [ovejas, busqueda]);
  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: filas.slice(desde, desde + cantidad), total: filas.length }), [filas]);

  const alternar = (id: string) =>
    setElegidas((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  const pendientes = ovejas.filter((o) => o.pendiente);

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    for (const id of elegidas) {
      datos.append("animal_id", id);
      datos.set(`peso_${id}`, pesos[id] ?? "");
    }
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6 lg:max-w-2xl">
      <input type="hidden" name="client_request_id" value={solicitud} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Campo etiqueta="Fecha de la esquila">
          {(id) => <input id={id} type="date" name="fecha" defaultValue={hoy} max={hoy} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="¿Quién esquiló?" ayuda="Opcional.">
          {(id) => <input id={id} name="esquilador" maxLength={120} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Nombre del esquilador" />}
        </Campo>
        <Campo etiqueta="Costo de la esquila" ayuda="Opcional. Lo que pagaste en total.">
          {(id) => <input id={id} name="costo" inputMode="decimal" autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 150.000" />}
        </Campo>
        <Campo etiqueta="Notas" ayuda="Opcional.">
          {(id) => <input id={id} name="notas" maxLength={1000} autoComplete="off" enterKeyHint="done" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <section className="space-y-3" aria-label="Ovejas esquiladas">
        <h2 className="border-b border-arena pb-1.5 font-display text-lg font-semibold">Ovejas esquiladas</h2>
        <FilaDesplazable>
          {pendientes.length > 0 ? (
            <Chip activo={false} onClick={() => setElegidas((p) => new Set([...p, ...pendientes.map((o) => o.id)]))}>
              Las que les toca · {pendientes.length}
            </Chip>
          ) : null}
          <Chip activo={false} onClick={() => setElegidas(new Set(ovejas.map((o) => o.id)))}>
            Todas · {ovejas.length}
          </Chip>
          <Chip activo={false} onClick={() => setElegidas(new Set())}>
            Quitar todas
          </Chip>
        </FilaDesplazable>
        {ovejas.length > 8 ? <CampoBusqueda onBuscar={setBusqueda} placeholder="Buscar por arete o nombre" /> : null}
        <ListaEscalable<OvejaElegible>
          key={busqueda}
          cargar={cargar}
          clave={(o) => o.id}
          vacio={<p className="px-2 py-6 text-center text-[0.9375rem] text-humo">Ninguna oveja coincide con la búsqueda.</p>}
          fila={(o) => {
            const activa = elegidas.has(o.id);
            return (
              <div className={`min-w-0 rounded-2xl bg-papel ring-1 transition ${activa ? "ring-2 ring-musgo" : "ring-arena"}`}>
                <button type="button" aria-pressed={activa} onClick={() => alternar(o.id)} className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-md ring-1 ${activa ? "bg-musgo text-sobre-musgo ring-musgo" : "bg-papel ring-arena"}`}>
                    {activa ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold [overflow-wrap:anywhere]">{o.numero_arete}{o.nombre ? <span className="font-normal text-humo"> · {o.nombre}</span> : null}</span>
                    <span className="block text-sm text-humo">{o.texto}</span>
                  </span>
                </button>
                {activa ? (
                  <div className="px-4 pb-3">
                    <input
                      aria-label={`Kilos de vellón de ${o.numero_arete}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={pesos[o.id] ?? ""}
                      onChange={(e) => setPesos((p) => ({ ...p, [o.id]: e.target.value }))}
                      placeholder="Kilos de vellón (opcional)"
                      className={CLASE_INPUT}
                    />
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      </section>

      {elegidas.size === 0 ? <Aviso tipo="atencion">Elige al menos una oveja: llevas 0 de 1 mínima.</Aviso> : <Aviso tipo="info">Vas a registrar la esquila de {elegidas.size} {elegidas.size === 1 ? "oveja" : "ovejas"}.</Aviso>}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={elegidas.size === 0}>
          Registrar esquila
        </Boton>
        <Link href="/esquila" className={clasesBoton("secundario")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
