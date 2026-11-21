"use client";

import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoIva } from "@/components/CampoIva";
import { CamposTrazabilidad } from "@/components/CamposTrazabilidad";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useMoneda } from "@/components/ProveedorMoneda";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { entradaBajaDeCampos, esquemaBaja, revisarBaja } from "@/lib/baja-reglas";
import { ETIQUETA_TIPO_BAJA, MOTIVOS_BAJA, TIPOS_BAJA } from "@/lib/bajas";
import { ESCENA_COBRO } from "@/lib/escenas-costos";
import { ESCENA_MOTIVO_BAJA, ESCENA_TIPO_BAJA } from "@/lib/escenas-forms-a-hato";
import { leerNumero } from "@/lib/numeros";
import { MENSAJE_GUARDADO_LOCAL, conBajaPendiente, etiquetaCampo, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { MotivoBaja, TipoBaja } from "@/lib/tipos";

const NUEVO = "__nuevo";
type Cobro = "cobrado" | "por_cobrar";

type Estado = {
  animal: string;
  tipo: TipoBaja | "";
  fecha: string;
  motivo: MotivoBaja | "";
  comprador: string;
  compradorNuevo: string;
  valor: string;
  iva: string;
  cobro: Cobro;
  vence: string;
  consumo: boolean;
  peso: string;
  guia: string;
  destino: string;
  detalle: string;
};

const inicial = (hoy: string): Estado => ({ animal: "", tipo: "", fecha: hoy, motivo: "", comprador: "", compradorNuevo: "", valor: "", iva: "", cobro: "cobrado", vence: "", consumo: false, peso: "", guia: "", destino: "", detalle: "" });

/**
 * Dar de baja sin señal: lo mismo que «Dar de baja» en la ficha (qué pasó: venta, muerte, sacrificio o pérdida; cuándo; si fue una venta, a quién, por
 * cuánto, si ya pagaron y si va para consumo; peso, guía y destino de una salida comercial; por qué sale y notas) con las mismas reglas (`esquemaBaja`
 * + `entradaBajaDeCampos`; el servidor las vuelve a aplicar con `guardarBajaCampo`, que además comprueba el nacimiento y el retiro de carne). Un animal
 * con una baja guardada en el celular no se ofrece de nuevo. Los controles de calidad de una salida para consumo se responden con señal.
 */
export function BajaCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const moneda = useMoneda();
  const ivaDefecto = referencia.compras.ivaDefecto;
  const [e, setE] = useState<Estado>(() => inicial(hoy));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const poner = <K extends keyof Estado>(k: K, v: Estado[K]) => {
    setE((p) => ({ ...p, [k]: v }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const pendientes = useMemo(() => conBajaPendiente(registros, usuarioId, fincaId, editando?.id), [registros, usuarioId, fincaId, editando?.id]);
  const activos = referencia.animales.filter((a) => a.activo && !pendientes.has(a.id));
  const elegido = referencia.animales.find((a) => a.id === e.animal);
  const enOrdeno = referencia.ordeno.some((h) => h.id === e.animal);
  const venta = e.tipo === "venta";
  const comercial = venta || e.tipo === "sacrificio";
  const valorNum = e.valor.trim() ? leerNumero(e.valor) : null;
  const valorInvalido = e.valor.trim() !== "" && valorNum === null;
  const pesoInvalido = comercial && e.peso.trim() !== "" && leerNumero(e.peso) === null;
  const hechos = registros.filter((x) => x.tipo === "baja" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const falta = !e.animal ? "Elige el animal que sale del hato." : !e.tipo ? "Elige qué pasó con el animal." : null;

  /** Los mismos campos que «Dar de baja» con señal (los vacíos no viajan). */
  const campos = (): Record<string, string> => {
    const x: Record<string, string> = {
      tipo: e.tipo, fecha: e.fecha, motivo: e.motivo, detalle: e.detalle,
      ...(venta
        ? {
            terceroId: e.comprador !== NUEVO ? e.comprador : "", compradorNuevo: e.comprador === NUEVO ? e.compradorNuevo : "", valor: e.valor,
            ivaTarifa: valorNum ? e.iva : "", cobro: valorNum ? e.cobro : "", cobroVence: valorNum && e.cobro === "por_cobrar" ? e.vence : "", destinoConsumo: e.consumo ? "si" : "",
          }
        : {}),
      ...(comercial ? { pesoKg: e.peso, guiaMovilizacion: e.guia, destino: e.destino } : {}),
    };
    return Object.fromEntries(Object.entries(x).filter(([, v]) => v.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy));
    setVuelta((n) => n + 1);
  };

  const guardar = async () => {
    if (falta) return setError(falta);
    if (venta && e.comprador === NUEVO && !e.compradorNuevo.trim()) return setError("Escribe el nombre del comprador nuevo.");
    const x = campos();
    const d = esquemaBaja.safeParse(entradaBajaDeCampos(e.animal, x));
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    const problema = revisarBaja(d.data, hoy);
    if (problema) return setError(problema);
    const id = editando?.id ?? crypto.randomUUID();
    const nombre = elegido ? etiquetaCampo(elegido) : "Animal";
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "baja", usuarioId, fincaId, animalId: e.animal, etiqueta: `${nombre} · ${ETIQUETA_TIPO_BAJA[d.data.tipo]}`, fecha: d.data.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${nombre} salió del hato` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    setEditando(r);
    setE({
      animal: r.animalId, tipo: (x.tipo as TipoBaja) ?? "", fecha: x.fecha ?? hoy, motivo: (x.motivo as MotivoBaja) ?? "",
      comprador: x.compradorNuevo ? NUEVO : (x.terceroId ?? ""), compradorNuevo: x.compradorNuevo ?? "", valor: x.valor ?? "", iva: x.ivaTarifa ?? "",
      cobro: (x.cobro as Cobro) ?? "cobrado", vence: x.cobroVence ?? "", consumo: x.destinoConsumo === "si", peso: x.pesoKg ?? "", guia: x.guiaMovilizacion ?? "", destino: x.destino ?? "", detalle: x.detalle ?? "",
    });
    setVuelta((n) => n + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.hato) return <Aviso>Tu rol no da de baja animales en esta finca.</Aviso>;

  const opcionesAnimal = [...activos, ...(elegido && !activos.includes(elegido) ? [elegido] : [])].map((a) => ({ valor: a.id, etiqueta: etiquetaCampo(a) }));

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <Campo etiqueta="Animal">
        {(id) => <Selector id={id} valor={e.animal} onCambio={(v) => poner("animal", String(v))} titulo="¿Qué animal sale del hato?" placeholder="Elegir el animal" opciones={opcionesAnimal} />}
      </Campo>

      <SelectorTarjetas<TipoBaja> titulo="¿Qué pasó con el animal?" valor={e.tipo} onCambio={(v) => poner("tipo", v)} opciones={TIPOS_BAJA.map((t) => ({ ...t, escena: ESCENA_TIPO_BAJA[t.valor] }))} />

      <Campo etiqueta="¿Cuándo pasó?">
        {(id) => <input id={id} type="date" value={e.fecha} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
      </Campo>

      {venta ? (
        <>
          <Campo etiqueta="Comprador (opcional)">
            {(id) => (
              <Selector
                id={id}
                valor={e.comprador}
                onCambio={(v) => poner("comprador", String(v))}
                titulo="¿A quién se lo vendiste?"
                placeholder="Elegir"
                permitirVacio
                opciones={[...referencia.ventas.compradores.map((t) => ({ valor: t.id, etiqueta: t.nombre })), { valor: NUEVO, etiqueta: "Otro comprador (no está en la lista)", detalle: "Escribes su nombre" }]}
              />
            )}
          </Campo>
          {e.comprador === NUEVO ? (
            <Campo etiqueta="Nombre del comprador" ayuda="Queda en tu lista de compradores al enviar (si ya existe, se usa el mismo).">
              {(id) => <input id={id} value={e.compradorNuevo} onChange={(ev) => poner("compradorNuevo", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          ) : null}
          <Campo etiqueta="Valor de la venta" ayuda={`Opcional. En ${moneda.codigo}.`} error={valorInvalido ? "Escribe solo números." : undefined}>
            {(id) => <input id={id} value={e.valor} inputMode="decimal" autoComplete="off" onChange={(ev) => poner("valor", ev.target.value)} className={CLASE_INPUT} placeholder="Ej. 450.000" />}
          </Campo>
          {valorNum ? (
            <>
              <CampoIva key={vuelta} total={valorNum} inicial={e.iva ? leerNumero(e.iva) : ivaDefecto} onCambio={(t) => setE((p) => (p.iva === t ? p : { ...p, iva: t }))} />
              <SelectorTarjetas<Cobro> titulo="¿Ya te pagaron?" valor={e.cobro} onCambio={(v) => v && poner("cobro", v)} opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: c === "cobrado" ? "Ya me pagaron" : "Me lo deben", escena: ESCENA_COBRO[c] }))} />
              {e.cobro === "por_cobrar" ? (
                <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
                  {(id) => <input id={id} type="date" value={e.vence} min={e.fecha} onChange={(ev) => poner("vence", ev.target.value)} className={CLASE_INPUT} />}
                </Campo>
              ) : null}
            </>
          ) : null}
          <label className="flex min-h-11 items-start gap-3 text-[0.9375rem]">
            <input type="checkbox" checked={e.consumo} onChange={(ev) => poner("consumo", ev.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--musgo)]" />
            <span>
              Va para consumo (frigorífico o carnicería)
              <span className="block text-[0.8125rem] text-humo">Si está en periodo de retiro de carne, no se podrá registrar así.</span>
            </span>
          </label>
        </>
      ) : null}

      {comercial && e.tipo ? (
        <CamposTrazabilidad tipo={e.tipo} peso={e.peso} onPeso={(v) => poner("peso", v)} pesoInvalido={pesoInvalido} guia={e.guia} onGuia={(v) => poner("guia", v)} destino={e.destino} onDestino={(v) => poner("destino", v)} />
      ) : null}

      <SelectorTarjetas<MotivoBaja> titulo="¿Por qué sale del hato? (opcional)" valor={e.motivo} onCambio={(v) => poner("motivo", v)} permitirVacio opciones={MOTIVOS_BAJA.map((m) => ({ ...m, escena: ESCENA_MOTIVO_BAJA[m.valor] }))} />

      <Campo etiqueta="Notas (opcional)">
        {(id) => <textarea id={id} value={e.detalle} maxLength={1000} rows={3} onChange={(ev) => poner("detalle", ev.target.value)} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {enOrdeno ? <Aviso tipo="info">Está en el ordeño: al darla de baja sale también de esa lista.</Aviso> : null}
      {e.tipo === "sacrificio" || (venta && e.consumo) ? <p className="text-sm text-humo">Los controles de calidad de una salida para consumo se responden después, con señal, desde la ficha del animal.</p> : null}
      {falta ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton variante="peligro" onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={falta !== null || valorInvalido || pesoInvalido}>{editando ? "Guardar corrección" : "Dar de baja"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-bajas-hechas">
          <h2 id="titulo-bajas-hechas" className="font-display text-xl font-semibold">Registradas en este celular · {hechos.length}</h2>
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
