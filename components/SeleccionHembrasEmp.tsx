"use client";

import { useCallback, useState, useTransition } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Cargando } from "@/components/Cargando";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { etiquetaAnimal } from "@/lib/animal";
import { aptitud, textoCC, textoEdad } from "@/lib/empadronamiento";
import { porcentaje } from "@/lib/endogamia";
import type { CandidataEmp } from "@/lib/tipos";

type Endo = { f: number; sobre: boolean };
type Fila = { c: CandidataEmp; clase: "apta" | "verificar" | "no"; motivos: string[] };
type Respuesta<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/** De dónde salen las hembras y su endogamia: de una temporada que ya existe o de los criterios de una que se está creando. */
export type FuenteHembras = {
  candidatas: () => Respuesta<CandidataEmp[]>;
  endogamia: (machoId: string, ids: string[]) => Respuesta<{ hembra_id: string; f: number; sobre_umbral: boolean }[]>;
};
/** `limite`: el número exacto de hembras que la temporada fijó para cada semental (nulo si solo hay una recomendación, que avisa pero no bloquea). */
export type MachoSeleccion = { id: string; etiqueta: string; asignadas: number; capacidad: number; limite?: number | null; externo?: boolean };
/** Lo que se eligió: las hembras, las que entran como excepción y cómo se llama cada una (para mostrarlas sin volver a buscarlas). */
export type SeleccionEmp = { machoId: string; hembraIds: string[]; excepcionIds: string[]; etiquetas: Record<string, string> };

const TRAMO = 30;
const LOTE_RPC = 400;
const LOTE_ELEGIR = 500;

/**
 * Elegir con qué hembras va un semental. Solo aparecen hembras **libres** (sin gestación, sin servicio esperando diagnóstico y fuera de
 * otra temporada abierta) que cumplen los criterios; las demás se listan aparte con su motivo. Calcula la endogamia de cada pareja ANTES
 * de confirmar y bloquea las que llegan al umbral de la finca (solo entran como excepción consciente, que queda registrada).
 */
export function SeleccionHembrasEmp({
  machos,
  umbral,
  fuente,
  inicial,
  boton,
  titulo = "Elegir hembras",
  textoConfirmar,
  deshabilitado = false,
  onConfirmar,
}: {
  machos: MachoSeleccion[];
  umbral: number;
  fuente: FuenteHembras;
  /** Selección que ya estaba hecha (al volver a abrir la hoja desde el formulario). */
  inicial?: { machoId: string; hembraIds: string[]; excepcionIds: string[] };
  /** Lo que dice el botón que abre la hoja y su aspecto. */
  boton: { texto: React.ReactNode; variante?: "primario" | "secundario" };
  titulo?: string;
  textoConfirmar: (n: number) => string;
  deshabilitado?: boolean;
  /** Devuelve un mensaje si no se pudo guardar; nulo si todo salió bien (la hoja se cierra). */
  onConfirmar: (sel: SeleccionEmp) => Promise<string | null>;
}) {
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

  /** Calcula la endogamia de cada pareja y, de lo ya elegido, deja solo lo que sigue siendo válido. */
  const calcular = useCallback(
    async (machoId: string, lista: Fila[], previas?: { hembraIds: string[]; excepcionIds: string[] }) => {
      setCalculando(true);
      setEndo(null);
      const ids = lista.filter((f) => f.clase !== "no").map((f) => f.c.animal_id);
      const mapa = new Map<string, Endo>();
      // De un semental de otro hato no hay genealogía: no se calcula endogamia, y no hay pareja que bloquear.
      if (machos.find((m) => m.id === machoId)?.externo) {
        for (const id of ids) mapa.set(id, { f: 0, sobre: false });
        setEndo(mapa);
        setCalculando(false);
        if (previas) {
          const validas = previas.hembraIds.filter((id) => mapa.has(id));
          setElegidas(new Set(validas));
          setExcepciones(new Set());
        }
        return;
      }
      for (let i = 0; i < ids.length; i += LOTE_RPC) {
        const { data, error: e } = await fuente.endogamia(machoId, ids.slice(i, i + LOTE_RPC));
        if (e) {
          setError(e.message);
          setCalculando(false);
          return;
        }
        for (const r of data ?? []) mapa.set(r.hembra_id, { f: Number(r.f), sobre: r.sobre_umbral });
      }
      setEndo(mapa);
      if (previas) {
        const marcadas = new Set(previas.excepcionIds);
        const validas = previas.hembraIds.filter((id) => mapa.has(id) && (!mapa.get(id)?.sobre || marcadas.has(id)));
        setElegidas(new Set(validas));
        setExcepciones(new Set(validas.filter((id) => marcadas.has(id) && mapa.get(id)?.sobre)));
      }
      setCalculando(false);
    },
    [fuente, machos],
  );

  const abrir = async () => {
    const machoInicial = inicial && machos.some((m) => m.id === inicial.machoId) ? inicial.machoId : (machos[0]?.id ?? "");
    setAbierta(true);
    setError(null);
    setFilas(null);
    setEndo(null);
    setBusqueda("");
    setMacho(machoInicial);
    setElegidas(new Set());
    setExcepciones(new Set());
    if (!machoInicial) return;
    const { data, error: e } = await fuente.candidatas();
    if (e) return setError(e.message);
    const orden = { apta: 0, verificar: 1, no: 2 } as const;
    const lista = (data ?? []).map((c) => ({ c, ...aptitud(c) })).sort((a, b) => orden[a.clase] - orden[b.clase]);
    setFilas(lista);
    void calcular(machoInicial, lista, inicial && inicial.machoId === machoInicial ? inicial : undefined);
  };

  const cambiarMacho = (id: string) => {
    setMacho(id);
    setElegidas(new Set());
    setExcepciones(new Set());
    if (filas) void calcular(id, filas);
  };

  const cupoDe = (m: string) => {
    const x = machos.find((k) => k.id === m);
    return x?.limite != null ? Math.max(0, x.limite - x.asignadas) : Infinity;
  };

  const alternar = (id: string) =>
    setElegidas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else if (n.size < cupoDe(macho)) n.add(id);
      return n;
    });

  const permitirExcepcion = (id: string) => {
    if (elegidas.size >= cupoDe(macho) && !elegidas.has(id)) return;
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
  const bloqueada = (id: string) => Boolean(endo?.get(id)?.sobre) && !excepciones.has(id);
  const aptasLibres = asignables.filter((f) => f.clase === "apta" && endo?.has(f.c.animal_id) && !bloqueada(f.c.animal_id));
  const elMacho = machos.find((m) => m.id === macho);
  const nombreMacho = elMacho?.etiqueta ?? "";
  const quedaria = (elMacho?.asignadas ?? 0) + elegidas.size;
  const sobreCapacidad = elMacho ? quedaria > elMacho.capacidad : false;
  const conExcepcion = [...elegidas].filter((id) => excepciones.has(id)).length;
  const limite = elMacho?.limite ?? null;
  const externo = elMacho?.externo === true;
  const cupo = limite != null ? Math.max(0, limite - (elMacho?.asignadas ?? 0)) : Infinity;
  const lleno = elegidas.size >= cupo;

  const confirmar = () =>
    iniciar(async () => {
      setError(null);
      const etiquetas: Record<string, string> = {};
      for (const f of filas ?? []) if (elegidas.has(f.c.animal_id)) etiquetas[f.c.animal_id] = etiquetaAnimal(f.c);
      const mensaje = await onConfirmar({ machoId: macho, hembraIds: [...elegidas], excepcionIds: [...elegidas].filter((id) => excepciones.has(id)), etiquetas });
      if (mensaje) return setError(mensaje);
      setAbierta(false);
      setElegidas(new Set());
      setExcepciones(new Set());
      setFilas(null);
      setEndo(null);
    });

  return (
    <>
      <Boton onClick={abrir} variante={boton.variante ?? "secundario"} disabled={machos.length === 0 || deshabilitado}>
        {boton.texto}
      </Boton>
      <Sheet
        abierta={abierta}
        onCerrar={() => (guardando ? undefined : setAbierta(false))}
        titulo={titulo}
        pie={
          <div className="space-y-2.5">
            {limite != null ? (
              <div aria-live="polite">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">
                    Llevas {(elMacho?.asignadas ?? 0) + elegidas.size} de {limite} {limite === 1 ? "hembra" : "hembras"}
                  </span>
                  <span className="text-humo">{lleno ? "Completo" : `Faltan ${cupo - elegidas.size}`}</span>
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={(elMacho?.asignadas ?? 0) + elegidas.size}>
                  <div className="h-full rounded-full bg-musgo transition-[width]" style={{ width: `${Math.min(100, (((elMacho?.asignadas ?? 0) + elegidas.size) / limite) * 100)}%` }} />
                </div>
              </div>
            ) : null}
            <Boton onClick={confirmar} pendiente={guardando} cargando="Guardando…" disabled={elegidas.size === 0 || calculando}>
              {elegidas.size === 0 ? "Elige las hembras" : textoConfirmar(elegidas.size)}
            </Boton>
          </div>
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
          {elMacho ? (
            limite != null ? (
              <p className="rounded-xl bg-lana px-3 py-2 text-[0.9375rem]" aria-live="polite">
                Esta temporada fijó <strong>{limite}</strong> {limite === 1 ? "hembra" : "hembras"} por semental. <strong>{nombreMacho}</strong> tiene {elMacho.asignadas}
                {elegidas.size > 0 ? ` y vas a sumar ${elegidas.size}` : ""}: {lleno ? "ya no caben más." : `caben ${cupo - elegidas.size} más.`}
              </p>
            ) : (
              <p className="text-sm text-humo">
                {elMacho.asignadas > 0
                  ? `${nombreMacho} tiene ${elMacho.asignadas} ${elMacho.asignadas === 1 ? "hembra asignada" : "hembras asignadas"}; lo recomendado es hasta ${elMacho.capacidad}.`
                  : `Lo recomendado para ${nombreMacho} es hasta ${elMacho.capacidad} hembras.`}
              </p>
            )
          ) : null}
          {externo ? <Aviso tipo="info">Este semental es de otro hato: no tenemos su genealogía, así que no se calcula la endogamia de cada pareja. Pídesela a su dueño antes de la monta.</Aviso> : null}
          <p className="text-sm text-humo">
            Solo aparecen hembras <strong>libres</strong>: sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta, y que cumplan los
            requisitos. Antes de asignar, {externo ? "se revisa que cada hembra siga libre." : `calculamos la endogamia de cada pareja: las que llegan al umbral de tu finca (${porcentaje(umbral)}) quedan bloqueadas.`}
          </p>

          {filas === null && !error ? <Cargando texto="Buscando hembras libres…" /> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}

          {filas !== null ? (
            <div className="space-y-3">
              {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
              {calculando ? <Cargando pequeno texto="Calculando la endogamia de cada pareja…" /> : null}

              {asignables.length === 0 ? (
                <p className="py-3 text-center text-[0.9375rem] text-humo">{busqueda ? "Ninguna coincide con la búsqueda." : "No hay hembras libres que cumplan los requisitos en este momento."}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm text-humo">
                    <span>{asignables.length} {asignables.length === 1 ? "hembra libre" : "hembras libres"}</span>
                    {aptasLibres.length > 0 && !lleno ? (
                      <button type="button" onClick={() => setElegidas((p) => new Set([...p, ...aptasLibres.filter((f) => !p.has(f.c.animal_id)).slice(0, Math.min(LOTE_ELEGIR, Math.max(0, cupo - p.size))).map((f) => f.c.animal_id)]))} disabled={lleno} className="min-h-11 font-semibold text-musgo disabled:opacity-40">
                        {limite != null ? `Elegir ${Math.min(aptasLibres.length, Math.max(0, cupo - elegidas.size))} aptas` : `Elegir las ${aptasLibres.length} aptas`}
                      </button>
                    ) : null}
                  </div>
                  <div className="-mx-2">
                    <ListaPorTramos
                      key={busqueda}
                      items={asignables}
                      clave={(f) => f.c.animal_id}
                      tramo={TRAMO}
                      arriba={false}
                      fila={(f) => {
                      const e = endo?.get(f.c.animal_id);
                      const sinPermiso = bloqueada(f.c.animal_id);
                      const conExc = excepciones.has(f.c.animal_id);
                      return (
                        <div className={`rounded-xl px-3 py-2 ${sinPermiso ? "bg-rojo/6" : "hover:bg-arena/50"}`}>
                          <label className={`flex min-h-12 items-start gap-3 ${sinPermiso ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}>
                            <input
                              type="checkbox"
                              checked={elegidas.has(f.c.animal_id)}
                              disabled={sinPermiso || !e || (lleno && !elegidas.has(f.c.animal_id))}
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
                            {e && !externo ? (
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
                        </div>
                      );
                    }}
                    />
                  </div>
                </>
              )}

              {noAptas.length > 0 ? (
                <div className="rounded-2xl bg-lana p-3">
                  <button type="button" onClick={() => setVerNoAptas((v) => !v)} aria-expanded={verNoAptas} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold">
                    {noAptas.length} {noAptas.length === 1 ? "hembra no puede entrar" : "hembras no pueden entrar"}
                    <ChevronDown className={`size-4 transition ${verNoAptas ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
                  </button>
                  {verNoAptas ? (
                    <div className="mt-1">
                      <ListaPorTramos
                        key={busqueda}
                        items={noAptas}
                        clave={(f) => f.c.animal_id}
                        tramo={TRAMO}
                        arriba={false}
                        fila={(f) => (
                          <div className="border-b border-arena py-2 text-[0.9375rem]">
                            <span className="font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(f.c)}</span>
                            <span className="block text-sm text-humo">{f.motivos.join(" · ")}</span>
                          </div>
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {sobreCapacidad && limite == null && elMacho ? (
            <Aviso tipo="atencion">
              {nombreMacho} quedaría con {quedaria} hembras y lo recomendado es hasta {elMacho.capacidad}. Puedes seguir, pero con tantas hembras baja la fertilidad del grupo.
            </Aviso>
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
