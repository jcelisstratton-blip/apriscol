"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRightLeft, Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { CUARENTENA_MIN_DIAS, CUARENTENA_RECOMENDADA_DIAS, ETIQUETA_MOTIVO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, MOTIVOS, textoOcupacion } from "@/lib/corrales";
import { ESCENA_MOTIVO } from "@/lib/escenas-corrales";
import { sumarDias } from "@/lib/fechas";
import { cupoDestino, leerMovimiento, motivoPorDestino, textoSinCupo } from "@/lib/movimiento-reglas";
import { MENSAJE_GUARDADO_LOCAL, coincideBusqueda, etiquetaCampo, ocupacion, ubicacionesEfectivas, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { MotivoMovimiento } from "@/lib/tipos";

const SIN_DESTINO = "__sin_destino";
const TODOS = "__todos";
const SIN_UBICACION = "__sin_ubicacion";

/**
 * Corrales sin señal: mover animales a un corral o potrero (o sacarlos de donde están) con las mismas reglas que con señal (`leerMovimiento`, el cupo
 * con `cupoDestino`; el servidor y la base lo vuelven a exigir). Dónde está cada uno sale de la copia de la finca más lo movido en este celular que
 * aún no se envía, así un lote se puede elegir por su corral («Corral 2 · 14») y rotar dos veces seguidas sin señal. Queda en el celular y se envía solo.
 * Los avisos de mezcla (lactantes, machos con hembras, pesos) necesitan los pesos del hato: salen al mover con señal.
 */
export function MoverCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState<MotivoMovimiento>("traslado");
  const [observaciones, setObservaciones] = useState("");
  const [animales, setAnimales] = useState<string[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [deDonde, setDeDonde] = useState(TODOS);
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const ubicaciones = referencia.ubicaciones;
  const nombreDe = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones]);
  const activos = useMemo(() => referencia.animales.filter((a) => a.activo), [referencia.animales]);
  const donde = useMemo(() => ubicacionesEfectivas(referencia, registros, usuarioId, editando?.id), [referencia, registros, usuarioId, editando?.id]);
  const ocupan = useMemo(() => ocupacion(donde), [donde]);
  const elegidos = new Set(animales);
  const sinDestino = destino === SIN_DESTINO;
  const elDestino = ubicaciones.find((u) => u.id === destino);
  const yaAhi = elDestino ? animales.filter((a) => donde.get(a) === elDestino.id).length : 0;
  const cupo = elDestino ? cupoDestino(elDestino.capacidad, ocupan.get(elDestino.id) ?? 0, animales.length, yaAhi) : null;
  const sinUbicacion = activos.filter((a) => !donde.get(a.id)).length;

  const lista = activos.filter((a) => {
    const u = donde.get(a.id) ?? null;
    if (deDonde === SIN_UBICACION && u) return false;
    if (deDonde !== TODOS && deDonde !== SIN_UBICACION && u !== deDonde) return false;
    return coincideBusqueda(a, busqueda);
  });
  const hechos = registros.filter((x) => x.tipo === "movimiento" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  const elegirDestino = (v: string) => {
    setDestino(v);
    const m = motivoPorDestino(ubicaciones.find((u) => u.id === v));
    if (m) setMotivo(m);
    setError(null);
  };
  const limpiar = () => {
    setEditando(null);
    setAnimales([]);
    setDestino("");
    setMotivo("traslado");
    setObservaciones("");
  };

  /** Los mismos campos que el formulario con señal. */
  const campos = (): Record<string, string> => {
    const c: Record<string, string> = { sin_destino: sinDestino ? "si" : "no", fecha, motivo };
    if (!sinDestino && destino) c.destino = destino;
    if (observaciones.trim()) c.observaciones = observaciones.trim();
    return c;
  };

  const guardar = async () => {
    const c = campos();
    const l = leerMovimiento(c, animales, hoy);
    if ("error" in l) return setError(l.error);
    if (elDestino && cupo?.sinCupo && cupo.libres !== null) return setError(textoSinCupo(elDestino.nombre, elDestino.capacidad ?? 0, ocupan.get(elDestino.id) ?? 0, cupo.libres, cupo.entran));
    const n = l.ids.length;
    const cuantos = n === 1 ? "1 animal" : `${n} animales`;
    setGuardando(true);
    try {
      await guardarEnCelular({
        id: editando?.id ?? crypto.randomUUID(),
        creadoEn: editando?.creadoEn,
        tipo: "movimiento",
        usuarioId,
        fincaId,
        animalId: l.ids[0],
        animales: l.ids,
        etiqueta: `${sinDestino ? "Sacar de su ubicación" : `A ${elDestino?.nombre ?? "otra instalación"}`} · ${cuantos}`,
        fecha,
        campos: c,
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? (sinDestino ? `${cuantos} sin ubicación` : `${cuantos} a ${elDestino?.nombre ?? "otra instalación"}`) : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (x: RegistroCampo) => {
    const c = x.campos ?? {};
    setEditando(x);
    setAnimales(x.animales ?? []);
    setDia(x.fecha === hoy ? "hoy" : "ayer");
    setDestino(c.sin_destino === "si" ? SIN_DESTINO : (c.destino ?? ""));
    setMotivo((c.motivo as MotivoMovimiento) ?? "traslado");
    setObservaciones(c.observaciones ?? "");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.corrales) return <Aviso>Tu rol no mueve animales en esta finca.</Aviso>;
  if (ubicaciones.length === 0) return <Aviso>La finca aún no tiene corrales ni potreros. Créalos en Hato → Corrales con señal y vuelve a abrir esta pantalla.</Aviso>;
  if (activos.length === 0) return <Aviso>No hay animales en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  const textoBoton = editando ? "Guardar corrección" : sinDestino ? "Sacar de su ubicación" : animales.length > 1 ? `Mover ${animales.length} animales` : "Mover";
  const faltan = animales.length === 0 ? "Elige los animales." : !destino ? "Elige a dónde van." : null;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <FilaDesplazable>
        <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
        <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
      </FilaDesplazable>

      <Campo etiqueta="¿A dónde van?">
        {(id) => (
          <Selector
            id={id}
            valor={destino}
            onCambio={(v) => elegirDestino(String(v))}
            titulo="¿A dónde van?"
            placeholder="Elegir corral o potrero"
            opciones={[
              ...ubicaciones.map((u) => ({ valor: u.id, etiqueta: u.nombre, detalle: `${ETIQUETA_TIPO_UBICACION[u.tipo]} · ${ETIQUETA_USO[u.uso]} · ${textoOcupacion(ocupan.get(u.id) ?? 0, u.capacidad)}` })),
              { valor: SIN_DESTINO, etiqueta: "Sacarlos de su ubicación (sin destino)" },
            ]}
          />
        )}
      </Campo>
      {elDestino?.estado === "descanso" ? (
        <Aviso tipo="atencion">
          {elDestino.nombre} estaba en descanso ({elDestino.diasDescanso ?? 0} de {elDestino.diasDescansoMin} días) cuando se guardó la lista. Entrar antes acorta el descanso y los parásitos no alcanzan a morir.
        </Aviso>
      ) : null}
      {elDestino?.uso === "cuarentena" ? <Aviso tipo="info">En cuarentena los animales se quedan al menos {CUARENTENA_MIN_DIAS} días (lo ideal, {CUARENTENA_RECOMENDADA_DIAS}) antes de pasar al lote general.</Aviso> : null}

      <section className="space-y-2">
        <p className="text-sm font-semibold">Animales</p>
        <button type="button" onClick={() => setEligiendo(true)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-arena bg-papel px-4 text-left">
          <span className={animales.length ? "font-semibold" : "text-humo/70"}>{animales.length === 0 ? "Elegir los animales" : animales.length === 1 ? "1 animal elegido" : `${animales.length} animales elegidos`}</span>
          <ArrowRightLeft className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <p className="text-sm text-humo">Puedes elegir todo un corral o potrero de una vez, o buscar de a uno.</p>
      </section>

      {elDestino && cupo?.sinCupo && cupo.libres !== null ? <Aviso tipo="atencion">{textoSinCupo(elDestino.nombre, elDestino.capacidad ?? 0, ocupan.get(elDestino.id) ?? 0, cupo.libres, cupo.entran)}</Aviso> : null}
      {elDestino && yaAhi > 0 && !cupo?.sinCupo ? <p className="-mt-3 text-sm text-humo">{yaAhi === 1 ? "1 ya está" : `${yaAhi} ya están`} en {elDestino.nombre}: no se mueven.</p> : null}

      <SelectorTarjetas<MotivoMovimiento> titulo="Motivo" valor={motivo} onCambio={(v) => v && setMotivo(v)} opciones={MOTIVOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOTIVO[m], escena: ESCENA_MOTIVO[m] }))} />

      <Campo etiqueta="Observaciones (opcional)">
        {(id) => <textarea id={id} value={observaciones} onChange={(ev) => setObservaciones(ev.target.value)} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {faltan ? <Aviso tipo="atencion">{faltan}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={faltan !== null || Boolean(cupo?.sinCupo)}>{textoBoton}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-movidos">
          <h2 id="titulo-movidos" className="font-display text-xl font-semibold">Registrados en este celular · {hechos.length}</h2>
          <ListaPorTramos
            items={hechos}
            clave={(x) => x.id}
            fila={(x) => (
              <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{x.etiqueta}</span>
                  {x.estado === "error" && x.error ? <span className="block text-sm text-rojo [overflow-wrap:anywhere]">{x.error}</span> : null}
                  {x.estado !== "enviado" ? (
                    <button type="button" onClick={() => corregir(x)} className="mt-0.5 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">Corregir</button>
                  ) : null}
                </span>
                <InsigniaCampo r={x} />
              </div>
            )}
          />
        </section>
      ) : null}

      <Sheet
        abierta={eligiendo}
        onCerrar={() => setEligiendo(false)}
        titulo="Elegir los animales"
        pie={<Boton onClick={() => setEligiendo(false)}>{animales.length === 0 ? "Listo" : animales.length === 1 ? "Listo · 1 animal" : `Listo · ${animales.length} animales`}</Boton>}
      >
        <div className="space-y-3">
          <FilaDesplazable>
            <Chip activo={deDonde === TODOS} onClick={() => setDeDonde(TODOS)}>Todos · {activos.length}</Chip>
            {ubicaciones.filter((u) => (ocupan.get(u.id) ?? 0) > 0).map((u) => (
              <Chip key={u.id} activo={deDonde === u.id} onClick={() => setDeDonde(u.id)}>{u.nombre} · {ocupan.get(u.id)}</Chip>
            ))}
            {sinUbicacion > 0 ? <Chip activo={deDonde === SIN_UBICACION} onClick={() => setDeDonde(SIN_UBICACION)}>Sin ubicación · {sinUbicacion}</Chip> : null}
          </FilaDesplazable>
          <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
          <div className="flex flex-wrap gap-2">
            <Chip activo={false} onClick={() => setAnimales([...new Set([...animales, ...lista.map((a) => a.id)])])}>{busqueda || deDonde !== TODOS ? `Elegir estos ${lista.length}` : "Elegir todos"}</Chip>
            {animales.length > 0 ? <Chip activo={false} onClick={() => setAnimales([])}>Quitar todos</Chip> : null}
          </div>
          {lista.length === 0 ? (
            <p className="py-6 text-center text-[0.9375rem] text-humo">Ningún animal coincide con tu búsqueda.</p>
          ) : (
            <ListaPorTramos
              key={`${deDonde}|${busqueda}`}
              items={lista}
              clave={(a) => a.id}
              fila={(a) => {
                const si = elegidos.has(a.id);
                const u = donde.get(a.id);
                return (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={si}
                    onClick={() => setAnimales(si ? animales.filter((x) => x !== a.id) : [...animales, a.id])}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2 text-left ring-1 ${si ? "bg-musgo/[0.07] ring-musgo" : "bg-papel ring-arena"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md border ${si ? "border-musgo bg-musgo text-sobre-musgo" : "border-arena"}`}>{si ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold [overflow-wrap:anywhere]">{etiquetaCampo(a)}</span>
                      <span className="block text-sm text-humo [overflow-wrap:anywhere]">{u ? (nombreDe.get(u) ?? "Otra instalación") : "Sin ubicación"}</span>
                    </span>
                  </button>
                );
              }}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}
