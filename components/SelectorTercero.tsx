"use client";

import { useCallback, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { CLASE_INPUT } from "@/components/Campo";
import { Sheet } from "@/components/Sheet";
import { crearTercero } from "@/app/(app)/mas/productos/actions";
import type { Tercero, TipoTercero } from "@/lib/tipos";
import { sinTildes } from "@/lib/texto";


/**
 * Elegir un proveedor o un comprador de la lista de la finca. Si todavía no está, se escribe su nombre en el buscador y se agrega ahí mismo:
 * se crea una sola vez y de ahí en adelante se elige. Nunca un campo de texto suelto, para que el mismo nombre no quede escrito de tres formas.
 */
export function SelectorTercero({
  id,
  nombre,
  tipo,
  terceros,
  valor,
  onCambio,
  titulo,
  placeholder = "Elegir…",
}: {
  id?: string;
  /** Nombre del campo oculto que viaja con el id del elegido. */
  nombre?: string;
  /** Qué se está eligiendo: a quién se le compra o a quién se le vende. */
  tipo: Exclude<TipoTercero, "ambos">;
  terceros: Tercero[];
  valor: string;
  onCambio: (id: string, tercero: Tercero | null) => void;
  titulo: string;
  placeholder?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [agregados, setAgregados] = useState<Tercero[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const todos = [...terceros, ...agregados.filter((a) => !terceros.some((t) => t.id === a.id))];
  const actual = todos.find((t) => t.id === valor);
  // Los que sirven para este uso (un comprador no se ofrece como proveedor), y el elegido aunque ya no esté activo.
  const ofrecidos = todos.filter((t) => (t.activo && (t.tipo === tipo || t.tipo === "ambos")) || t.id === valor);
  const visibles = busqueda ? ofrecidos.filter((t) => sinTildes(t.nombre).includes(sinTildes(busqueda))) : ofrecidos;
  const nombraIgual = (t: Tercero) => sinTildes(t.nombre.trim()) === sinTildes(busqueda);
  const hayIgual = Boolean(busqueda) && ofrecidos.some(nombraIgual);
  // Existe con ese nombre pero se usaba para lo otro (o estaba apagado): agregarlo lo habilita también aquí, sin duplicarlo.
  const existeParaOtroUso = Boolean(busqueda) && !hayIgual && todos.some(nombraIgual);

  const cerrar = () => {
    setAbierta(false);
    setBusqueda("");
    setError(null);
  };
  const elegir = (t: Tercero | null) => {
    onCambio(t?.id ?? "", t);
    cerrar();
  };
  const agregar = async () => {
    setCreando(true);
    setError(null);
    const r = await crearTercero({ nombre: busqueda, tipo });
    setCreando(false);
    if (!r.ok) return setError(r.error);
    setAgregados((a) => [...a, r.tercero]);
    elegir(r.tercero);
  };

  return (
    <>
      {nombre ? <input type="hidden" name={nombre} value={valor} /> : null}
      <button id={id} type="button" onClick={() => setAbierta(true)} aria-haspopup="dialog" className={`${CLASE_INPUT} flex items-center justify-between gap-3 text-left`}>
        <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${actual ? "" : "text-humo/70"}`}>{actual ? actual.nombre : placeholder}</span>
        <ChevronDown className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
      </button>
      <Sheet abierta={abierta} onCerrar={cerrar} titulo={titulo}>
        <div className="mb-3">
          <CampoBusqueda onBuscar={alBuscar} placeholder={ofrecidos.length === 0 ? "Escribe el nombre para agregarlo" : "Buscar o escribir uno nuevo"} retardo={150} />
        </div>
        {busqueda && !hayIgual ? (
          <button
            type="button"
            onClick={() => void agregar()}
            disabled={creando}
            className="mb-2 flex min-h-12 w-full items-center gap-2.5 rounded-xl bg-musgo/10 px-3 text-left font-semibold text-musgo hover:bg-musgo/15 disabled:opacity-60"
          >
            <Plus className="size-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {creando ? "Agregando…" : existeParaOtroUso ? `Usar «${busqueda}» también como ${tipo}` : `Agregar «${busqueda}»`}
            </span>
          </button>
        ) : null}
        {error ? <p role="alert" className="mb-2 px-1 text-sm text-rojo">{error}</p> : null}
        {ofrecidos.length === 0 && !busqueda ? <p className="py-4 text-center text-sm text-humo">Todavía no tienes ninguno. Escribe su nombre arriba y agrégalo: la próxima vez solo lo eliges.</p> : null}
        <ul className="-mx-2 space-y-0.5">
          <li>
            <button type="button" onClick={() => elegir(null)} className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-humo hover:bg-arena/60">
              Sin especificar
            </button>
          </li>
          {visibles.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => elegir(t)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-arena/60">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{t.nombre}</span>
                {t.id === valor ? <Check className="size-5 shrink-0 text-musgo" strokeWidth={2} /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
