"use client";

import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoIva } from "@/components/CampoIva";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useDinero, useMoneda } from "@/components/ProveedorMoneda";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { leerDespacho } from "@/lib/despacho-reglas";
import { ESCENA_COBRO } from "@/lib/escenas-costos";
import { ESCENA_DESTINO_LECHE } from "@/lib/escenas-forms-a-leche";
import { litros as fmtLitros } from "@/lib/fechas";
import { DESTINOS_LECHE, ETIQUETA_DESTINO } from "@/lib/leche-calidad";
import { leerNumero } from "@/lib/numeros";
import type { DestinoLeche } from "@/lib/tipos";
import { MENSAJE_GUARDADO_LOCAL, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

const NUEVO = "__nuevo";
const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type EstadoCobro = "cobrado" | "por_cobrar";

type Estado = {
  fecha: string;
  litros: string;
  destino: DestinoLeche;
  comprador: string;
  compradorNuevo: string;
  tanque: string;
  guia: string;
  precio: string;
  iva: string;
  cobro: EstadoCobro;
  vence: string;
  temperatura: string;
  observaciones: string;
};

const inicial = (hoy: string, precio: number | null, iva: number | null): Estado => ({
  fecha: hoy, litros: "", destino: "queseria", comprador: "", compradorNuevo: "", tanque: "", guia: "", precio: coma(precio), iva: coma(iva), cobro: "cobrado", vence: "", temperatura: "", observaciones: "",
});

/**
 * Un despacho de leche sin señal: lo mismo que «Registrar despacho» (litros, destino, comprador, tanque, guía, precio por litro con su IVA, si ya pagaron
 * o lo deben, temperatura y observaciones) con los compradores y el último precio de la copia de la finca y las mismas reglas (`leerDespacho`; el
 * servidor las vuelve a aplicar con `guardarDespachoCampo`). Un comprador que no está en la lista se escribe y se crea (o se reutiliza) al enviar. Los
 * controles de calidad del despacho se responden con señal, desde Leche → Despachos.
 */
export function DespachoCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const dinero = useDinero();
  const moneda = useMoneda();
  const d0 = referencia.despachos;
  const [e, setE] = useState<Estado>(() => inicial(hoy, d0.precioHabitual, d0.ivaDefecto));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const poner = <K extends keyof Estado>(k: K, valor: Estado[K]) => {
    setE((p) => ({ ...p, [k]: valor }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const lts = leerNumero(e.litros);
  const precio = leerNumero(e.precio);
  const total = lts && lts > 0 && precio && precio > 0 ? Math.round(lts * precio * 100) / 100 : null;
  const hechos = registros.filter((x) => x.tipo === "despacho" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const falta = !(lts && lts > 0) ? "Escribe cuántos litros salieron." : null;

  /** Los mismos campos que «Registrar despacho» con señal (los vacíos no viajan). */
  const campos = (): Record<string, string> => {
    const vendido = total !== null;
    const x: Record<string, string> = {
      fecha: e.fecha, litros: e.litros, destino_tipo: e.destino,
      tercero_id: e.comprador !== NUEVO ? e.comprador : "", comprador_nuevo: e.comprador === NUEVO ? e.compradorNuevo : "",
      tanque: e.tanque, guia: e.guia, precio_litro: e.precio,
      iva_tarifa: vendido ? e.iva : "", cobro: vendido ? e.cobro : "", cobro_vence: vendido && e.cobro === "por_cobrar" ? e.vence : "",
      temperatura_c: e.temperatura, observaciones: e.observaciones,
    };
    return Object.fromEntries(Object.entries(x).filter(([, valor]) => valor.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy, d0.precioHabitual, d0.ivaDefecto));
    setVuelta((n) => n + 1);
  };

  const guardar = async () => {
    if (falta) return setError(falta);
    if (e.comprador === NUEVO && !e.compradorNuevo.trim()) return setError("Escribe el nombre del comprador nuevo.");
    const x = campos();
    const l = leerDespacho(x);
    if ("error" in l) return setError(l.error ?? "Revisa los datos.");
    const id = editando?.id ?? crypto.randomUUID();
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "despacho", usuarioId, fincaId, animalId: id, etiqueta: `Despacho · ${fmtLitros(l.d.litros)} L · ${ETIQUETA_DESTINO[e.destino]}`, fecha: l.d.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? "Despacho guardado" : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    setEditando(r);
    setE({
      fecha: x.fecha ?? hoy, litros: x.litros ?? "", destino: (x.destino_tipo as DestinoLeche) ?? "queseria",
      comprador: x.comprador_nuevo ? NUEVO : (x.tercero_id ?? ""), compradorNuevo: x.comprador_nuevo ?? "",
      tanque: x.tanque ?? "", guia: x.guia ?? "", precio: x.precio_litro ?? "", iva: x.iva_tarifa ?? "", cobro: (x.cobro as EstadoCobro) ?? "cobrado", vence: x.cobro_vence ?? "",
      temperatura: x.temperatura_c ?? "", observaciones: x.observaciones ?? "",
    });
    setVuelta((n) => n + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.leche) return <Aviso>Tu rol no registra despachos de leche en esta finca.</Aviso>;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Litros despachados">
          {(id) => <input id={id} value={e.litros} onChange={(ev) => poner("litros", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 120" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Fecha">
          {(id) => <input id={id} type="date" value={e.fecha} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
        </Campo>
      </div>

      <SelectorTarjetas<DestinoLeche> titulo="¿A dónde fue la leche?" valor={e.destino} onCambio={(v) => v && poner("destino", v)} opciones={DESTINOS_LECHE.map((d) => ({ valor: d, etiqueta: ETIQUETA_DESTINO[d], escena: ESCENA_DESTINO_LECHE[d] }))} />

      <Campo etiqueta="Comprador (opcional)">
        {(id) => (
          <Selector
            id={id}
            valor={e.comprador}
            onCambio={(valor) => poner("comprador", String(valor))}
            titulo="¿A quién se la vendiste?"
            placeholder="Elegir"
            permitirVacio
            opciones={[...d0.compradores.map((t) => ({ valor: t.id, etiqueta: t.nombre })), { valor: NUEVO, etiqueta: "Otro comprador (no está en la lista)", detalle: "Escribes su nombre" }]}
          />
        )}
      </Campo>
      {e.comprador === NUEVO ? (
        <Campo etiqueta="Nombre del comprador" ayuda="Queda en tu lista de compradores al enviar (si ya existe, se usa el mismo).">
          {(id) => <input id={id} value={e.compradorNuevo} onChange={(ev) => poner("compradorNuevo", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Tanque o lote" ayuda="Opcional. De cuál tanque salió.">
          {(id) => <input id={id} value={e.tanque} onChange={(ev) => poner("tanque", ev.target.value)} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Guía o factura" ayuda="Opcional.">
          {(id) => <input id={id} value={e.guia} onChange={(ev) => poner("guia", ev.target.value)} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta={`Precio por litro (${moneda.simbolo})`} ayuda={d0.precioHabitual != null ? "Es el último precio al que vendiste; cámbialo si subió o bajó." : "Opcional. Con precio, el despacho cuenta como una venta."}>
        {(id) => <input id={id} value={e.precio} onChange={(ev) => poner("precio", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 2.500" className={CLASE_INPUT} />}
      </Campo>
      {total !== null ? (
        <>
          <p className="-mt-2 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
            Valor del despacho: <span className="font-display text-lg font-semibold tabular-nums">{dinero(total)}</span>
          </p>
          <CampoIva key={vuelta} total={total} inicial={leerNumero(e.iva)} onCambio={(t) => setE((p) => (p.iva === t ? p : { ...p, iva: t }))} />
          <SelectorTarjetas<EstadoCobro> titulo="¿Ya te pagaron?" valor={e.cobro} onCambio={(c) => c && poner("cobro", c)} opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: c === "cobrado" ? "Ya me pagaron" : "Me lo deben", escena: ESCENA_COBRO[c] }))} />
          {e.cobro === "por_cobrar" ? (
            <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
              {(id) => <input id={id} type="date" value={e.vence} min={e.fecha} onChange={(ev) => poner("vence", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          ) : null}
        </>
      ) : null}

      <Campo etiqueta="Temperatura al despachar (°C)" ayuda="Opcional.">
        {(id) => <input id={id} value={e.temperatura} onChange={(ev) => poner("temperatura", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 5" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones (opcional)">
        {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      <p className="text-sm text-humo">Los controles de calidad del despacho se responden con señal, desde Leche → Despachos.</p>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={falta !== null}>{editando ? "Guardar corrección" : "Guardar despacho"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-despachos-hechos">
          <h2 id="titulo-despachos-hechos" className="font-display text-xl font-semibold">Registrados en este celular · {hechos.length}</h2>
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
