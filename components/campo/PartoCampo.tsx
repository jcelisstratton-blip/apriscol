"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { ESCENA_CAUSA_ABORTO, ESCENA_ESTADO_CRIA, ESCENA_TIPO_PARTO } from "@/lib/escenas-forms-b-reproduccion";
import { ESCENA_SEXO } from "@/lib/escenas-forms-b-hato";
import { formatoFecha, sumarDias } from "@/lib/fechas";
import { datosPorTipoParto, esquemaParto, leerCrias, revisarCrias } from "@/lib/parto-reglas";
import { CAUSAS_ABORTO, DETALLE_CAUSA, DETALLE_PARTO, ETIQUETA_CAUSA, ETIQUETA_PARTO, MAX_CRIAS, TIPOS_PARTO } from "@/lib/reproduccion";
import { MENSAJE_GUARDADO_LOCAL, areteRepetido, conPartoPendiente, etiquetaCampo, hembrasParaParto, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { CausaAborto, TipoParto } from "@/lib/tipos";

type Fila = { sexo: "hembra" | "macho" | ""; vivo: boolean; peso: string; arete: string; nombre: string };
const NUEVA: Fila = { sexo: "", vivo: true, peso: "", arete: "", nombre: "" };

type Estado = { hembra: string; fecha: string; tipo: TipoParto; filas: Fila[]; causa: CausaAborto | ""; asistido: string; complicaciones: string; protocolo: string; observaciones: string };
const inicial = (hoy: string): Estado => ({ hembra: "", fecha: hoy, tipo: "normal", filas: [{ ...NUEVA }], causa: "", asistido: "", complicaciones: "", protocolo: "", observaciones: "" });

/**
 * Partos sin señal: lo mismo que «Registrar parto» en la ficha (qué pasó: normal, asistido, cesárea o aborto; una fila por cría con sexo, viva o muerta,
 * peso, arete y nombre; quién asistió; causa del aborto; complicaciones, protocolo posoperatorio y observaciones) con las mismas reglas (`esquemaParto`,
 * `datosPorTipoParto`, `leerCrias`, `revisarCrias`; el servidor las vuelve a aplicar con `prepararParto` y guarda con `registrar_parto`, todo o nada). El
 * parto se liga solo al servicio de la gestación en curso. Una cría viva con arete se crea en el hato; el arete se avisa si ya existe en la copia o en otro
 * registro del celular. Una hembra con un parto guardado en el celular no se ofrece de nuevo.
 */
export function PartoCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [e, setE] = useState<Estado>(() => inicial(hoy));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof Estado>(k: K, v: Estado[K]) => {
    setE((p) => ({ ...p, [k]: v }));
    setError(null);
  };
  const cambiarCria = (i: number, cambio: Partial<Fila>) => {
    setE((p) => ({ ...p, filas: p.filas.map((x, k) => (k === i ? { ...x, ...cambio } : x)) }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const pendientes = useMemo(() => conPartoPendiente(registros, usuarioId, fincaId, editando?.id), [registros, usuarioId, fincaId, editando?.id]);
  const hembras = hembrasParaParto(referencia.hembras).filter((h) => !pendientes.has(h.id) || h.id === e.hembra);
  const elegida = referencia.hembras.find((h) => h.id === e.hembra);
  const conServicio = elegida && (elegida.estado === "gestante" || elegida.estado === "servida") && elegida.ultimoServicio ? elegida.ultimoServicio : null;
  const enLecheYa = referencia.ordeno.some((h) => h.id === e.hembra);
  const esAborto = e.tipo === "aborto";
  const esCesarea = e.tipo === "cesarea";
  const hechos = registros.filter((x) => x.tipo === "parto" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  /** Los mismos campos que «Registrar parto» con señal (las crías, como texto JSON). */
  const campos = (): Record<string, string> => {
    const x: Record<string, string> = {
      fecha: e.fecha, tipo: e.tipo, causa_aborto: esAborto ? e.causa : "", asistido_por: e.tipo !== "normal" ? e.asistido : "",
      complicaciones: e.complicaciones, protocolo_posoperatorio: esCesarea ? e.protocolo : "", observaciones: e.observaciones,
      crias: esAborto ? "" : JSON.stringify(e.filas.map((f) => ({ sexo: f.sexo || null, vivo: f.vivo, peso: f.peso.trim() || undefined, arete: f.arete.trim() || undefined, nombre: f.nombre.trim() || undefined }))),
    };
    return Object.fromEntries(Object.entries(x).filter(([, v]) => v.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy));
  };

  const guardar = async () => {
    if (!e.hembra) return setError("Elige la hembra que parió.");
    const x = campos();
    const d = esquemaParto.safeParse({ ...x, madre_id: e.hembra });
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    if (d.data.fecha > hoy) return setError("La fecha no puede ser futura: registra lo que ya pasó.");
    if (conServicio && d.data.fecha <= conServicio) return setError("El parto debe ser posterior al servicio.");
    const clinico = datosPorTipoParto(d.data);
    if ("error" in clinico) return setError(clinico.error);
    const c = leerCrias(d.data.crias, d.data.tipo);
    if ("error" in c) return setError(c.error ?? "Revisa los datos de las crías.");
    const problema = revisarCrias(c.crias);
    if (problema) return setError(problema);
    const repetido = c.crias.find((cria) => cria.arete && areteRepetido(cria.arete, referencia, registros, editando?.id));
    if (repetido?.arete) return setError(`El arete ${repetido.arete} ya está en tu hato o en otro registro de este celular. Usa otro para la cría.`);
    const id = editando?.id ?? crypto.randomUUID();
    const nombre = elegida ? etiquetaCampo(elegida) : "Hembra";
    const resumen = esAborto ? "aborto" : `${ETIQUETA_PARTO[e.tipo].toLowerCase()} · ${c.crias.length === 1 ? "1 cría" : `${c.crias.length} crías`}`;
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "parto", usuarioId, fincaId, animalId: e.hembra, etiqueta: `${nombre} · ${resumen}`, fecha: d.data.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `Parto de ${nombre} guardado` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    let filas: Fila[] = [{ ...NUEVA }];
    try {
      const lista = JSON.parse(x.crias ?? "[]") as { sexo?: string | null; vivo?: boolean; peso?: string; arete?: string; nombre?: string }[];
      if (Array.isArray(lista) && lista.length) filas = lista.map((c) => ({ sexo: (c.sexo as Fila["sexo"]) ?? "", vivo: c.vivo !== false, peso: c.peso ?? "", arete: c.arete ?? "", nombre: c.nombre ?? "" }));
    } catch {
      // Sin crías legibles: se empieza con una fila vacía.
    }
    setEditando(r);
    setE({ hembra: r.animalId, fecha: x.fecha ?? hoy, tipo: (x.tipo as TipoParto) ?? "normal", filas, causa: (x.causa_aborto as CausaAborto) ?? "", asistido: x.asistido_por ?? "", complicaciones: x.complicaciones ?? "", protocolo: x.protocolo_posoperatorio ?? "", observaciones: x.observaciones ?? "" });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.reproduccion) return <Aviso>Tu rol no registra partos en esta finca.</Aviso>;
  if (referencia.hembras.length === 0) return <Aviso>No hay hembras en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  return (
    <div className="space-y-5">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <Campo etiqueta="Hembra">
        {(id) => (
          <Selector
            id={id}
            valor={e.hembra}
            onCambio={(v) => poner("hembra", String(v))}
            titulo="¿Qué hembra parió?"
            placeholder="Elegir la hembra"
            opciones={hembras.map((h) => ({ valor: h.id, etiqueta: etiquetaCampo(h), detalle: h.estado === "gestante" ? "Gestante" : h.estado === "servida" ? "Servida" : undefined }))}
          />
        )}
      </Campo>
      {conServicio ? <Aviso tipo="info">Se liga al servicio del {formatoFecha(conServicio)}.</Aviso> : null}

      <Campo etiqueta="Fecha del parto">
        {(id) => <input id={id} type="date" value={e.fecha} min={conServicio ? sumarDias(conServicio, 1) : undefined} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
      </Campo>

      <SelectorTarjetas<TipoParto> titulo="¿Qué pasó?" valor={e.tipo} onCambio={(v) => v && poner("tipo", v)} opciones={TIPOS_PARTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_PARTO[t], detalle: DETALLE_PARTO[t], escena: ESCENA_TIPO_PARTO[t] }))} />

      {!esAborto ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Crías ({e.filas.length})</legend>
          {e.filas.map((x, i) => (
            <div key={i} className="space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Cría {i + 1}</p>
                {e.filas.length > 1 ? (
                  <button type="button" onClick={() => poner("filas", e.filas.filter((_, k) => k !== i))} aria-label={`Quitar la cría ${i + 1}`} className="grid size-11 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo">
                    <Trash2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <SelectorTarjetas titulo="Sexo" valor={x.sexo} onCambio={(v) => cambiarCria(i, { sexo: v as Fila["sexo"] })} opciones={[{ valor: "hembra", etiqueta: "Hembra", escena: ESCENA_SEXO.hembra }, { valor: "macho", etiqueta: "Macho", escena: ESCENA_SEXO.macho }]} />
              <SelectorTarjetas titulo="Estado" valor={x.vivo ? "viva" : "muerta"} onCambio={(v) => v && cambiarCria(i, { vivo: v === "viva", arete: v === "viva" ? x.arete : "", nombre: v === "viva" ? x.nombre : "" })} opciones={[{ valor: "viva", etiqueta: "Viva", escena: ESCENA_ESTADO_CRIA.viva }, { valor: "muerta", etiqueta: "Muerta", escena: ESCENA_ESTADO_CRIA.muerta }]} />
              <Campo etiqueta="Peso al nacer (kg)" ayuda="Opcional.">
                {(id) => <input id={id} value={x.peso} onChange={(ev) => cambiarCria(i, { peso: ev.target.value })} inputMode="decimal" autoComplete="off" placeholder="Ej. 3,2" className={CLASE_INPUT} />}
              </Campo>
              {x.vivo ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Arete" ayuda="Opcional. Si lo escribes, la cría se crea en tu hato.">
                    {(id) => <input id={id} value={x.arete} onChange={(ev) => cambiarCria(i, { arete: ev.target.value })} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
                  </Campo>
                  <Campo etiqueta="Nombre" ayuda="Opcional.">
                    {(id) => <input id={id} value={x.nombre} onChange={(ev) => cambiarCria(i, { nombre: ev.target.value })} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
                  </Campo>
                </div>
              ) : null}
            </div>
          ))}
          {e.filas.length < MAX_CRIAS ? (
            <button type="button" onClick={() => poner("filas", [...e.filas, { ...NUEVA }])} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar otra cría
            </button>
          ) : null}
        </fieldset>
      ) : (
        <>
          <SelectorTarjetas<CausaAborto> titulo="Causa aparente" valor={e.causa} onCambio={(v) => poner("causa", v)} opciones={CAUSAS_ABORTO.map((c) => ({ valor: c, etiqueta: ETIQUETA_CAUSA[c], detalle: DETALLE_CAUSA[c], escena: ESCENA_CAUSA_ABORTO[c] }))} />
          {e.causa === "infecciosa" ? (
            <Aviso tipo="atencion">Si se sospecha una infección, aísla a la hembra, maneja el feto y la placenta con guantes (algunas causas, como la brucelosis, pasan a las personas) y avisa a tu veterinario.</Aviso>
          ) : null}
        </>
      )}

      {e.tipo !== "normal" ? (
        <Campo etiqueta={e.tipo === "asistido" || esCesarea ? "Asistido por" : "Asistido por (opcional)"} ayuda="El veterinario o la persona que ayudó.">
          {(id) => <input id={id} value={e.asistido} onChange={(ev) => poner("asistido", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <Campo etiqueta={esCesarea ? "Complicaciones quirúrgicas (opcional)" : "Complicaciones (opcional)"}>
        {(id) => <textarea id={id} value={e.complicaciones} onChange={(ev) => poner("complicaciones", ev.target.value)} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>
      {esCesarea ? (
        <Campo etiqueta="Protocolo posoperatorio y fármacos (opcional)">
          {(id) => <textarea id={id} value={e.protocolo} onChange={(ev) => poner("protocolo", ev.target.value)} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      ) : null}
      <Campo etiqueta={esAborto ? "Observaciones clínicas (opcional)" : "Observaciones (opcional)"}>
        {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {!esAborto && elegida && !enLecheYa ? <p className="text-sm text-humo">Al enviarse, la hembra entra al ordeño (se le abre la lactancia).</p> : null}
      {!e.hembra ? <Aviso tipo="atencion">Elige la hembra que parió.</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={!e.hembra}>{editando ? "Guardar corrección" : "Guardar parto"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-partos-hechos">
          <h2 id="titulo-partos-hechos" className="font-display text-xl font-semibold">Registrados en este celular · {hechos.length}</h2>
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
    </div>
  );
}
