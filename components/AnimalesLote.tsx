"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { SelectorAnimales, type AnimalElegido } from "@/components/SelectorAnimales";
import { useToast } from "@/components/Toast";
import { asignarLote } from "@/app/(app)/carne/actions";
import { faltaParaMeta, gdp, kg } from "@/lib/carne";
import { formatoFecha } from "@/lib/fechas";
import type { Especie } from "@/lib/tipos";

export type AnimalDeLote = {
  id: string;
  etiqueta: string;
  peso: number | null;
  fecha: string | null;
  gdpTotal: number | null;
  /** Hasta cuándo no puede ir a beneficio por un tratamiento (retiro de carne), si aplica. */
  retiroCarneHasta: string | null;
};

/** Los animales de un lote de ceba: quiénes son, cuánto pesan, cuánto ganan, y poner o sacar animales del lote. */
export function AnimalesLote({
  fincaId,
  especies,
  loteId,
  cerrado,
  pesoMeta,
  animales,
  puedeEditar,
}: {
  fincaId: string;
  especies: Especie[];
  loteId: string;
  cerrado: boolean;
  pesoMeta: number | null;
  animales: AnimalDeLote[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [agregando, setAgregando] = useState(false);
  const [elegidos, setElegidos] = useState<AnimalElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [quitando, setQuitando] = useState<string | null>(null);

  const yaEstan = new Set(animales.map((a) => a.id));
  const nuevos = elegidos.filter((a) => !yaEstan.has(a.id));

  const agregar = () =>
    iniciar(async () => {
      setError(null);
      const r = await asignarLote({ loteId, animales: nuevos.map((a) => a.id) });
      if (!r.ok) return setError(r.error);
      toast.exito(r.cambiados === 1 ? "1 animal agregado al lote" : `${r.cambiados} animales agregados al lote`);
      setElegidos([]);
      setAgregando(false);
      router.refresh();
    });

  const quitar = (id: string) => {
    setQuitando(id);
    iniciar(async () => {
      const r = await asignarLote({ loteId: null, animales: [id] });
      setQuitando(null);
      if (!r.ok) return toast.error(r.error);
      toast.exito("Animal sacado del lote");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {puedeEditar && !cerrado ? (
        agregando ? (
          <div className="space-y-3 rounded-3xl bg-papel p-4 ring-1 ring-arena">
            <p className="font-semibold">¿Qué animales entran al lote?</p>
            <SelectorAnimales fincaId={fincaId} especies={especies} valor={elegidos} onCambio={setElegidos} />
            {nuevos.length < elegidos.length ? <p className="text-sm text-humo">Los que ya están en el lote no se vuelven a agregar.</p> : null}
            {error ? <Aviso tipo="error">{error}</Aviso> : null}
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => { setAgregando(false); setElegidos([]); setError(null); }} disabled={pendiente}>
                Cancelar
              </Boton>
              <Boton onClick={agregar} pendiente={pendiente} cargando="Agregando…" disabled={nuevos.length === 0}>
                {nuevos.length > 0 ? `Agregar ${nuevos.length}` : "Agregar"}
              </Boton>
            </div>
          </div>
        ) : (
          <Boton variante="secundario" ancho={false} onClick={() => setAgregando(true)}>
            <UserPlus className="mr-2 size-4" strokeWidth={2} aria-hidden="true" /> Agregar animales
          </Boton>
        )
      ) : null}

      {animales.length === 0 ? (
        <EstadoVacio icono={<UserPlus strokeWidth={1.5} />} titulo="El lote no tiene animales" descripcion="Agrega los animales que vas a engordar para seguir su peso y su ganancia." />
      ) : (
        <ListaPorTramos
          items={animales}
          clave={(a) => a.id}
          fila={(a) => {
            const falta = faltaParaMeta(a.peso, pesoMeta);
            return (
              <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
                <Link href={`/hato/${a.id}#crecimiento`} className="block min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{a.etiqueta}</span>
                  <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                    {a.peso !== null ? `${kg(a.peso)} el ${formatoFecha(a.fecha, { day: "numeric", month: "short" })}` : "Sin pesos todavía"}
                    {a.gdpTotal !== null ? ` · ${gdp(a.gdpTotal)}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {falta === 0 ? <Insignia tono="ok">Listo para beneficio</Insignia> : falta !== null ? <Insignia>{`Faltan ${kg(falta)}`}</Insignia> : null}
                    {falta === 0 && a.retiroCarneHasta ? <Insignia tono="alerta">{`En retiro hasta el ${formatoFecha(a.retiroCarneHasta, { day: "numeric", month: "short" })}`}</Insignia> : null}
                  </span>
                </Link>
                {puedeEditar && !cerrado ? (
                  <button
                    type="button"
                    onClick={() => quitar(a.id)}
                    disabled={pendiente}
                    aria-label={`Sacar a ${a.etiqueta} del lote`}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-humo transition hover:bg-arena hover:text-rojo disabled:opacity-50"
                  >
                    {quitando === a.id ? <span className="text-xs">…</span> : <X className="size-5" strokeWidth={2} aria-hidden="true" />}
                  </button>
                ) : null}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
