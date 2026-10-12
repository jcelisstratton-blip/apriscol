"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, ShieldAlert } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Cargando } from "@/components/Cargando";
import { Insignia } from "@/components/Insignia";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { asignarHembras } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { aptitud, textoCC, textoEdad } from "@/lib/empadronamiento";
import { porcentaje } from "@/lib/endogamia";
import type { CandidataEmp } from "@/lib/tipos";

type Endo = { f: number; sobre: boolean };
type Fila = { c: CandidataEmp; clase: "apta" | "verificar" | "no"; motivos: string[] };

const MOSTRAR = 60;
const LOTE_RPC = 400;

/**
 * Asignar hembras a un semental de la temporada. Filtra solas las hembras que cumplen los criterios del empadronamiento, calcula la
 * endogamia de cada pareja ANTES de confirmar y bloquea las que llegan al umbral de la finca (solo se pueden asignar como excepción
 * consciente, que queda registrada).
 */
export function AsignarHembrasEmp({ loteId, machos, umbral }: { loteId: string; machos: { id: string; etiqueta: string }[]; umbral: number }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [macho, setMacho] = useState(machos[0]?.id ?? "");
  const [endo, setEndo] = useState<Map<string, Endo> | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [excepciones, setExcepciones] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [verNoAptas, setVerNoAptas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const alBuscar = useCallback((t: string) => setBusqueda(t.toLowerCase()), []);

  const calcular = useCallback(
    async (machoId: string, lista: Fila[]) => {
      setCalculando(true);
      setEndo(null);
      const ids = lista.filter((f) => f.clase !== "no").map((f) => f.c.animal_id);
      const mapa = new Map<string, Endo>();
      const supabase = crearClienteNavegador();
      for (let i = 0; i < ids.length; i += LOTE_RPC) {
        const { data, error: e } = await supabase.rpc("empadronamiento_endogamia", { p_lote: loteId, p_macho: machoId, p_hembras: ids.slice(i, i + LOTE_RPC) });
        if (e) {
          setError(e.message);
          setCalculando(false);
          return;
        }
        for (const r of data ?? []) mapa.set(r.hembra_id, { f: Number(r.f), sobre: r.sobre_umbral });
      }
      setEndo(mapa);
      setCalculando(false);
    },
    [loteId],
  );

  const abrir = async () => {
    setAbierta(true);
    setError(null);
    if (filas || !macho) return;
    const { data, error: e } = await crearClienteNavegador().rpc("empadronamiento_candidatas", { p_lote: loteId });
    if (e) return setError(e.message);
    const orden = { apta: 0, verificar: 1, no: 2 } as const;
    const lista = (data ?? [])
      .map((c) => ({ c, ...aptitud(c) }))
      .sort((a, b) => orden[a.clase] - orden[b.clase]);
    setFilas(lista);
    void calcular(macho, lista);
  };

  const cambiarMacho = (id: string) => {
    setMacho(id);
    setElegidas(new Set());
    setExcepciones(new Set());
    if (filas) void calcular(id, filas);
  };

  const alternar = (id: string) =>
    setElegidas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const permitirExcepcion = (id: string) => {
    setExcepciones((p) => new Set(p).add(id));
    setElegidas((p) => new Set(p).add(id));
  };
  const quitarExcepcion = (id: string) => {
    setExcepciones((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    setElegidas((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  };

  const coincide = (f: Fila) => !busqueda || f.c.numero_arete.toLowerCase().includes(busqueda) || (f.c.nombre ?? "").toLowerCase().includes(busqueda);
  const asignables = (filas ?? []).filter((f) => f.clase !== "no" && coincide(f));
  const noAptas = (filas ?? []).filter((f) => f.clase === "no" && coincide(f));
  const visibles = asignables.slice(0, MOSTRAR);
  const bloqueada = (id: string) => Boolean(endo?.get(id)?.sobre) && !excepciones.has(id);
  const aptasLibres = asignables.filter((f) => f.clase === "apta" && endo?.has(f.c.animal_id) && !bloqueada(f.c.animal_id));
  const nombreMacho = machos.find((m) => m.id === macho)?.etiqueta ?? "";
  const conExcepcion = [...elegidas].filter((id) => excepciones.has(id)).length;

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await asignarHembras({ loteId, machoId: macho, hembraIds: [...elegidas], excepcionIds: [...elegidas].filter((id) => excepciones.has(id)) });
      if (!r.ok) return setError(r.error);
      toast.exito(`${r.agregadas} ${r.agregadas === 1 ? "hembra asignada" : "hembras asignadas"} a ${nombreMacho}`);
      setAbierta(false);
      setElegidas(new Set());
      setExcepciones(new Set());
      setFilas(null);
      setEndo(null);
      router.refresh();
    });

  return (
    <>
      <Boton onClick={abrir} variante="secundario" disabled={machos.length === 0}>
        <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Agregar hembras
      </Boton>
      <Sheet
        abierta={abierta}
        onCerrar={() => (guardando ? undefined : setAbierta(false))}
        titulo="Agregar hembras a la temporada"
        pie={
          <Boton onClick={guardar} pendiente={guardando} cargando="Asignando…" disabled={elegidas.size === 0 || calculando}>
            {elegidas.size === 0 ? "Elige las hembras" : `Asignar ${elegidas.size} ${elegidas.size === 1 ? "hembra" : "hembras"}`}
          </Boton>
        }
      >
        <div className="space-y-4">
          {machos.length > 1 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Semental de este grupo</p>
              <Selector valor={macho} onCambio={(v) => v && cambiarMacho(String(v))} titulo="¿Con qué semental?" opciones={machos.map((m) => ({ valor: m.id, etiqueta: m.etiqueta }))} />
            </div>
          ) : (
            <p className="text-[0.9375rem]">
              Semental: <strong className="[overflow-wrap:anywhere]">{nombreMacho}</strong>
            </p>
          )}
          <p className="text-sm text-humo">
            Solo aparecen las hembras que cumplen los criterios de la temporada. Antes de asignar, calculamos la endogamia de cada pareja: las que llegan
            al umbral de tu finca ({porcentaje(umbral)}) quedan bloqueadas.
          </p>

          {filas === null && !error ? <Cargando texto="Buscando hembras…" /> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}

          {filas !== null ? (
            <div className="space-y-3">
              {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
              {calculando ? <Cargando pequeno texto="Calculando la endogamia de cada pareja…" /> : null}

              {asignables.length === 0 ? (
                <p className="py-3 text-center text-[0.9375rem] text-humo">{busqueda ? "Ninguna coincide con la búsqueda." : "No hay hembras que cumplan los criterios en este momento."}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm text-humo">
                    <span>Mostrando {visibles.length} de {asignables.length}</span>
                    {aptasLibres.length > 0 ? (
                      <button type="button" onClick={() => setElegidas((p) => new Set([...p, ...aptasLibres.slice(0, 500).map((f) => f.c.animal_id)]))} className="min-h-11 font-semibold text-musgo">
                        Elegir las {aptasLibres.length} aptas
                      </button>
                    ) : null}
                  </div>
                  <ul className="-mx-2 space-y-1">
                    {visibles.map((f) => {
                      const e = endo?.get(f.c.animal_id);
                      const sinPermiso = bloqueada(f.c.animal_id);
                      const conExc = excepciones.has(f.c.animal_id);
                      return (
                        <li key={f.c.animal_id} className={`rounded-xl px-3 py-2 ${sinPermiso ? "bg-rojo/6" : "hover:bg-arena/50"}`}>
                          <label className={`flex min-h-12 items-start gap-3 ${sinPermiso ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}>
                            <input
                              type="checkbox"
                              checked={elegidas.has(f.c.animal_id)}
                              disabled={sinPermiso || !e}
                              onChange={() => alternar(f.c.animal_id)}
                              className="mt-3 size-5 shrink-0 accent-[var(--musgo)]"
                            />
                            <span className="min-w-0 flex-1 py-1.5">
                              <span className="block font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(f.c)}</span>
                              <span className="block text-sm text-humo">
                                {textoEdad(f.c.edad_meses)} · {f.c.peso_kg != null ? `${String(f.c.peso_kg).replace(".", ",")} kg` : "sin peso"} · CC {textoCC(f.c.cc)}
                              </span>
                              {f.motivos.length > 0 ? (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {f.motivos.map((m) => (
                                    <Insignia key={m} tono="aviso">{m}</Insignia>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            {e ? (
                              <span className="flex shrink-0 flex-col items-end gap-1 py-1.5">
                                <span className="text-sm font-bold tabular-nums">{porcentaje(e.f)}</span>
                                <NivelEndogamia f={e.f} umbral={umbral} />
                              </span>
                            ) : null}
                          </label>
                          {e?.sobre ? (
                            <div className="ml-8 mt-1 space-y-1 text-sm">
                              {conExc ? (
                                <p className="flex items-start gap-1.5 font-semibold text-rojo">
                                  <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" /> Excepción: se asignará aunque llegue al umbral y quedará registrado.
                                </p>
                              ) : (
                                <p className="text-rojo">Bloqueada: la cría tendría {porcentaje(e.f)} de endogamia, el umbral es {porcentaje(umbral)}.</p>
                              )}
                              <div className="flex flex-wrap gap-x-4">
                                <a href={`/hato/cruza?macho=${macho}&hembra=${f.c.animal_id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
                                  Ver por qué
                                </a>
                                {conExc ? (
                                  <button type="button" onClick={() => quitarExcepcion(f.c.animal_id)} className="min-h-11 font-semibold text-humo underline-offset-4 hover:underline">
                                    Quitar la excepción
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => permitirExcepcion(f.c.animal_id)} className="min-h-11 font-semibold text-rojo underline-offset-4 hover:underline">
                                    Asignar de todos modos
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {asignables.length > MOSTRAR ? <p className="text-sm text-humo">Hay más: afina la búsqueda para verlas.</p> : null}
                </>
              )}

              {noAptas.length > 0 ? (
                <div className="rounded-2xl bg-lana p-3">
                  <button type="button" onClick={() => setVerNoAptas((v) => !v)} aria-expanded={verNoAptas} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold">
                    {noAptas.length} {noAptas.length === 1 ? "hembra no puede entrar" : "hembras no pueden entrar"}
                    <ChevronDown className={`size-4 transition ${verNoAptas ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
                  </button>
                  {verNoAptas ? (
                    <ul className="mt-1 divide-y divide-arena">
                      {noAptas.slice(0, MOSTRAR).map((f) => (
                        <li key={f.c.animal_id} className="py-2 text-[0.9375rem]">
                          <span className="font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(f.c)}</span>
                          <span className="block text-sm text-humo">{f.motivos.join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {conExcepcion > 0 ? (
            <Aviso tipo="atencion">
              {conExcepcion} {conExcepcion === 1 ? "pareja supera" : "parejas superan"} el umbral de endogamia. Queda registrado que se asignó como excepción.
            </Aviso>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
