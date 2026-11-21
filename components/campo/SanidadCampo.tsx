"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Syringe } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas, type OpcionTarjeta } from "@/components/SelectorTarjetas";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { esquemaEvento } from "@/lib/evento-sanitario";
import { ANESTESIAS, CATEGORIAS, COJERAS, ETAPAS, MOTIVOS, REGLAS, datosPorTipoEvento, diasSugeridosProxima, type OpcionCampo } from "@/lib/sanidad-campos";
import { ETIQUETA_EVENTO, ETIQUETA_VIA, TIPOS_EVENTO, UNIDADES_DOSIS, VIAS } from "@/lib/sanidad";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_VIA } from "@/lib/escenas-forms-a-sanidad";
import { ESCENA_CAMPO, ESCENA_GENERICA } from "@/lib/escenas-sanidad-campos";
import { sumarDias } from "@/lib/fechas";
import { MENSAJE_GUARDADO_LOCAL, coincideBusqueda, etiquetaCampo, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { TipoEvento, ViaAplicacion } from "@/lib/tipos";

const OTRO = "otro";
const aTarjetas = (grupo: string, opciones: OpcionCampo[]): OpcionTarjeta<string>[] =>
  opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, detalle: o.detalle, escena: ESCENA_CAMPO[`${grupo}:${o.valor}`] ?? ESCENA_GENERICA }));

type Estado = {
  tipo: TipoEvento;
  categoria: string;
  etapa: string;
  motivo: string;
  diasTratamiento: string;
  cojera: string;
  concentracion: string;
  minutos: string;
  anestesia: string;
  productoId: string;
  productoNombre: string;
  dosis: string;
  unidad: string;
  via: ViaAplicacion | "";
  retiroLeche: string;
  retiroCarne: string;
  lote: string;
  responsable: string;
  diagnostico: string;
  observaciones: string;
  proxima: string;
};

const inicial = (tipo: TipoEvento = "vacunacion"): Estado => ({
  tipo, categoria: "", etapa: "", motivo: "", diasTratamiento: "", cojera: "", concentracion: "", minutos: "", anestesia: "", productoId: "", productoNombre: "",
  dosis: "", unidad: "ml", via: "", retiroLeche: "0", retiroCarne: "0", lote: "", responsable: "", diagnostico: "", observaciones: "", proxima: "",
});

/**
 * Sanidad sin señal: lo que se le hizo a uno o varios animales (vacuna, desparasitación, tratamiento, podología, pediluvio, cirugía u otro), con lo que
 * pide cada tipo (`REGLAS`) y las mismas reglas que el formulario con señal (`esquemaEvento` + `datosPorTipoEvento`; el servidor vuelve a validar con
 * `leerEventoSanitario`). El producto sale del catálogo guardado o se escribe; el lote de una compra se elige después, con señal (quien compra puede
 * escribirlo aquí). Queda en el celular y se envía solo.
 */
export function SanidadCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [e, setE] = useState<Estado>(() => inicial());
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [animales, setAnimales] = useState<string[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);
  const poner = <K extends keyof Estado>(k: K, v: Estado[K]) => {
    setE((p) => ({ ...p, [k]: v }));
    setError(null);
  };

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const r = REGLAS[e.tipo];
  const activos = useMemo(() => referencia.animales.filter((a) => a.activo), [referencia.animales]);
  const elegidos = new Set(animales);
  const lista = activos.filter((a) => coincideBusqueda(a, busqueda));
  const producto = referencia.productos.find((p) => p.id === e.productoId) ?? null;
  const conMedicamento = r.producto !== "segun_medicamento" || e.productoId !== "";
  const verRetiro = r.retiro !== "oculto" && (r.retiro !== "segun_medicamento" || conMedicamento);
  const verDosis = r.dosisVisible || r.dosisObligatoria || r.cantidadBano;
  const hechos = registros.filter((x) => x.tipo === "sanidad" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  const cambiarTipo = (t: TipoEvento) => setE((p) => ({ ...inicial(t), responsable: p.responsable }));
  const elegirProducto = (id: string) => {
    const p = referencia.productos.find((x) => x.id === id);
    setE((prev) => ({ ...prev, productoId: id, productoNombre: id === OTRO ? prev.productoNombre : "", retiroLeche: p ? String(p.retiroLeche) : prev.retiroLeche, retiroCarne: p ? String(p.retiroCarne) : prev.retiroCarne, unidad: p?.unidad ?? prev.unidad }));
    setError(null);
  };
  const elegirEtapa = (v: string) => {
    const dias = diasSugeridosProxima(e.tipo, v);
    setE((p) => ({ ...p, etapa: v, proxima: dias ? sumarDias(fecha, dias) : p.proxima }));
  };

  /** Los campos con los mismos nombres que el formulario con señal (lo que no aplica al tipo se manda vacío y el servidor lo descarta). */
  const campos = (): Record<string, string> => {
    const c: Record<string, string> = {
      tipo: e.tipo, fecha, categoria: e.categoria, etapa: e.etapa, motivo: e.motivo, dias_tratamiento: e.diasTratamiento, cojera: e.cojera,
      concentracion_pct: e.concentracion, minutos: e.minutos, anestesia: e.anestesia,
      producto_id: e.productoId, producto_nombre: e.productoId === OTRO || e.productoId === "" ? e.productoNombre : "",
      dosis: e.dosis, unidad_dosis: e.dosis ? e.unidad : "", via: e.via,
      retiro_leche_dias: verRetiro ? e.retiroLeche : "0", retiro_carne_dias: verRetiro ? e.retiroCarne : "0",
      lote_producto: referencia.puede.lotes ? e.lote : "", responsable: e.responsable, diagnostico: e.diagnostico, observaciones: e.observaciones, proxima_fecha: e.proxima,
    };
    return Object.fromEntries(Object.entries(c).filter(([, v]) => v.trim() !== ""));
  };

  const guardar = async () => {
    if (animales.length === 0) return setError("Elige al menos un animal.");
    const c = campos();
    const d = esquemaEvento.safeParse(c);
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    if (d.data.proxima_fecha && d.data.proxima_fecha <= fecha) return setError("La próxima dosis debe ser después de la fecha de esta aplicación.");
    const nombre = producto?.nombre ?? d.data.producto_nombre;
    if (r.producto === "requerido" && !nombre) return setError("Indica el producto que se aplicó.");
    const porTipo = datosPorTipoEvento(e.tipo, {
      categoria: d.data.categoria, motivo: d.data.motivo, etapa: d.data.etapa, dias_tratamiento: d.data.dias_tratamiento, cojera: d.data.cojera,
      concentracion_pct: d.data.concentracion_pct, minutos: d.data.minutos, anestesia: d.data.anestesia, diagnostico: d.data.diagnostico,
      responsable: d.data.responsable, producto: nombre, dosis: d.data.dosis, via: d.data.via,
    }, true);
    if ("error" in porTipo) return setError(porTipo.error);
    setGuardando(true);
    try {
      const id = editando?.id ?? crypto.randomUUID();
      await guardarEnCelular({
        id,
        creadoEn: editando?.creadoEn,
        tipo: "sanidad",
        usuarioId,
        fincaId,
        animalId: animales[0],
        animales,
        etiqueta: `${ETIQUETA_EVENTO[e.tipo]}${nombre ? ` · ${nombre}` : ""} · ${animales.length === 1 ? "1 animal" : `${animales.length} animales`}`,
        fecha,
        campos: c,
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${ETIQUETA_EVENTO[e.tipo]} guardada para ${animales.length === 1 ? "1 animal" : `${animales.length} animales`}` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    setEditando(null);
    setAnimales([]);
    setE((p) => ({ ...inicial(p.tipo), responsable: p.responsable, productoId: p.productoId, productoNombre: p.productoNombre, unidad: p.unidad, retiroLeche: p.retiroLeche, retiroCarne: p.retiroCarne }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (x: RegistroCampo) => {
    const c = x.campos ?? {};
    setEditando(x);
    setAnimales(x.animales ?? []);
    setDia(x.fecha === hoy ? "hoy" : "ayer");
    setE({
      ...inicial((c.tipo as TipoEvento) ?? "vacunacion"),
      categoria: c.categoria ?? "", etapa: c.etapa ?? "", motivo: c.motivo ?? "", diasTratamiento: c.dias_tratamiento ?? "", cojera: c.cojera ?? "",
      concentracion: c.concentracion_pct ?? "", minutos: c.minutos ?? "", anestesia: c.anestesia ?? "", productoId: c.producto_id ?? "", productoNombre: c.producto_nombre ?? "",
      dosis: c.dosis ?? "", unidad: c.unidad_dosis ?? "ml", via: (c.via as ViaAplicacion) ?? "", retiroLeche: c.retiro_leche_dias ?? "0", retiroCarne: c.retiro_carne_dias ?? "0",
      lote: c.lote_producto ?? "", responsable: c.responsable ?? "", diagnostico: c.diagnostico ?? "", observaciones: c.observaciones ?? "", proxima: c.proxima_fecha ?? "",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.sanidad) return <Aviso>Tu rol no registra sanidad en esta finca.</Aviso>;
  if (activos.length === 0) return <Aviso>No hay animales en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  const productos = [
    ...referencia.productos.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
    { valor: OTRO, etiqueta: "Otro producto", detalle: "Escribe su nombre" },
  ];

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={() => { setEditando(null); setAnimales([]); setE(inicial()); }} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <FilaDesplazable>
        <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
        <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
      </FilaDesplazable>

      <SelectorTarjetas<TipoEvento> titulo="¿Qué se hizo?" valor={e.tipo} onCambio={(v) => v && cambiarTipo(v)} opciones={TIPOS_EVENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t], escena: ESCENA_EVENTO[t] }))} />
      <p className="-mt-3 text-sm text-humo">{r.ayuda}</p>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Animales</p>
        <button type="button" onClick={() => setEligiendo(true)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-arena bg-papel px-4 text-left">
          <span className={animales.length ? "font-semibold" : "text-humo/70"}>{animales.length === 0 ? "Elegir los animales" : animales.length === 1 ? "1 animal elegido" : `${animales.length} animales elegidos`}</span>
          <Syringe className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </section>

      {CATEGORIAS[e.tipo] ? <SelectorTarjetas titulo={r.tituloCategoria ?? "¿Qué fue?"} valor={e.categoria} onCambio={(v) => poner("categoria", String(v))} opciones={aTarjetas(e.tipo, CATEGORIAS[e.tipo] ?? [])} /> : null}
      {r.etapa ? <SelectorTarjetas titulo="¿Qué dosis es?" valor={e.etapa} onCambio={(v) => elegirEtapa(String(v))} opciones={aTarjetas("etapa", ETAPAS)} /> : null}
      {r.motivo ? <SelectorTarjetas titulo="¿Por qué se desparasita?" valor={e.motivo} onCambio={(v) => poner("motivo", String(v))} opciones={aTarjetas("motivo", MOTIVOS)} /> : null}
      {r.cojera ? <SelectorTarjetas titulo="Cojera" valor={e.cojera} onCambio={(v) => poner("cojera", String(v))} permitirVacio etiquetaVacio="No lo revisé" opciones={aTarjetas("cojera", COJERAS)} /> : null}
      {r.anestesia ? <SelectorTarjetas titulo="Anestesia" valor={e.anestesia} onCambio={(v) => poner("anestesia", String(v))} opciones={aTarjetas("anestesia", ANESTESIAS)} /> : null}
      {r.solucion ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Concentración (%)">
            {(id) => <input id={id} value={e.concentracion} onChange={(ev) => poner("concentracion", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 10" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Minutos">
            {(id) => <input id={id} value={e.minutos} onChange={(ev) => poner("minutos", ev.target.value)} inputMode="numeric" autoComplete="off" placeholder="Ej. 5" className={CLASE_INPUT} />}
          </Campo>
        </div>
      ) : null}
      {r.diasTratamiento ? (
        <Campo etiqueta="Días de tratamiento">
          {(id) => <input id={id} value={e.diasTratamiento} onChange={(ev) => poner("diasTratamiento", ev.target.value)} inputMode="numeric" autoComplete="off" placeholder="Ej. 5" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <section className="space-y-3">
        <Campo etiqueta={r.producto === "requerido" ? "Producto aplicado" : "Producto (opcional)"}>
          {(id) => <Selector id={id} titulo="Producto" valor={e.productoId} opciones={productos} onCambio={(v) => elegirProducto(String(v))} placeholder="Elegir el producto" permitirVacio />}
        </Campo>
        {e.productoId === OTRO || (referencia.productos.length === 0 && r.producto !== "segun_medicamento") ? (
          <Campo etiqueta="Nombre del producto">
            {(id) => <input id={id} value={e.productoNombre} onChange={(ev) => poner("productoNombre", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        ) : null}
        {verDosis ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <Campo etiqueta={r.cantidadBano ? "Cantidad del baño" : r.dosisObligatoria ? "Dosis" : "Dosis (opcional)"}>
                {(id) => <input id={id} value={e.dosis} onChange={(ev) => poner("dosis", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 2,5" className={CLASE_INPUT} />}
              </Campo>
              <Campo etiqueta="Unidad">
                {(id) => <Selector id={id} titulo="Unidad" valor={e.unidad} opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))} onCambio={(v) => poner("unidad", String(v))} />}
              </Campo>
            </div>
            {r.cantidadBano ? null : <SelectorTarjetas<ViaAplicacion> titulo="¿Por dónde se aplicó?" valor={e.via} onCambio={(v) => poner("via", v as ViaAplicacion | "")} permitirVacio opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))} />}
          </>
        ) : null}
        {referencia.puede.lotes && r.lote ? (
          <Campo etiqueta="Lote del producto" ayuda="Opcional. Si lo compraste, puedes elegirlo después desde el registro con señal.">
            {(id) => <input id={id} value={e.lote} onChange={(ev) => poner("lote", ev.target.value)} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        ) : null}
      </section>

      {verRetiro ? (
        <section className="space-y-2">
          <p className="text-sm font-semibold">Días de retiro</p>
          <p className="text-sm text-humo">{r.ayudaRetiro}</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Leche">
              {(id) => <input id={id} value={e.retiroLeche} onChange={(ev) => poner("retiroLeche", ev.target.value)} inputMode="numeric" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Carne">
              {(id) => <input id={id} value={e.retiroCarne} onChange={(ev) => poner("retiroCarne", ev.target.value)} inputMode="numeric" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          </div>
        </section>
      ) : null}

      {r.veterinario !== "no" ? (
        <Campo etiqueta={`${r.etiquetaVeterinario}${r.veterinario === "requerido" ? "" : " (opcional)"}`}>
          {(id) => <input id={id} value={e.responsable} onChange={(ev) => poner("responsable", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}
      {r.diagnostico ? (
        <Campo etiqueta={`${r.diagnostico.etiqueta}${r.diagnostico.obligatorio ? "" : " (opcional)"}`} ayuda={r.diagnostico.ayuda}>
          {(id) => <textarea id={id} value={e.diagnostico} onChange={(ev) => poner("diagnostico", ev.target.value)} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      ) : null}

      <section className="space-y-2">
        <Campo etiqueta={`${r.proxima.etiqueta} (opcional)`} ayuda={r.proxima.ayuda}>
          {(id) => <input id={id} type="date" value={e.proxima} min={sumarDias(fecha, 1)} onChange={(ev) => poner("proxima", ev.target.value)} className={CLASE_INPUT} />}
        </Campo>
        <FilaDesplazable>
          {r.proxima.chips.map((c) => (
            <Chip key={c.dias} activo={e.proxima === sumarDias(fecha, c.dias)} onClick={() => poner("proxima", sumarDias(fecha, c.dias))}>{c.texto}</Chip>
          ))}
        </FilaDesplazable>
      </section>

      <Campo etiqueta={`${r.etiquetaObservaciones} (opcional)`}>
        {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={animales.length === 0}>
        {editando ? "Guardar corrección" : animales.length > 1 ? `Guardar para ${animales.length} animales` : "Guardar"}
      </Boton>
      {animales.length === 0 ? <p className="-mt-3 text-sm text-humo">Elige al menos un animal para guardar.</p> : null}

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-sanidad-hechos">
          <h2 id="titulo-sanidad-hechos" className="font-display text-xl font-semibold">Registrados en este celular · {hechos.length}</h2>
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
          <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
          <div className="flex flex-wrap gap-2">
            <Chip activo={false} onClick={() => setAnimales([...new Set([...animales, ...lista.map((a) => a.id)])])}>{busqueda ? "Elegir los que salen" : "Elegir todos"}</Chip>
            {animales.length > 0 ? <Chip activo={false} onClick={() => setAnimales([])}>Quitar todos</Chip> : null}
          </div>
          {lista.length === 0 ? (
            <p className="py-6 text-center text-[0.9375rem] text-humo">Ningún animal coincide con tu búsqueda.</p>
          ) : (
            <ListaPorTramos
              key={busqueda}
              items={lista}
              clave={(a) => a.id}
              fila={(a) => {
                const si = elegidos.has(a.id);
                return (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={si}
                    onClick={() => setAnimales(si ? animales.filter((x) => x !== a.id) : [...animales, a.id])}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2 text-left ring-1 ${si ? "bg-musgo/[0.07] ring-musgo" : "bg-papel ring-arena"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-md border ${si ? "border-musgo bg-musgo text-sobre-musgo" : "border-arena"}`}>{si ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}</span>
                    <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{etiquetaCampo(a)}</span>
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
