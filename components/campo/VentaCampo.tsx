"use client";

import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoIva } from "@/components/CampoIva";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useDinero } from "@/components/ProveedorMoneda";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { ESCENA_COBRO, ESCENA_LINEA_VENTA } from "@/lib/escenas-costos";
import { leerNumero } from "@/lib/numeros";
import { textoPrecio } from "@/lib/productos";
import { precioDeCada, textoPorUnidad } from "@/lib/unidades";
import { esquemaVenta, revisarVenta } from "@/lib/venta-reglas";
import { MENSAJE_GUARDADO_LOCAL, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

const NUEVO = "__nuevo";
const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type EstadoCobro = "cobrado" | "por_cobrar";
const ETIQUETA_COBRO: Record<EstadoCobro, string> = { cobrado: "Ya me pagaron", por_cobrar: "Me lo deben" };

type Estado = {
  producto: string;
  cantidad: string;
  precio: string;
  fecha: string;
  comprador: string;
  compradorNuevo: string;
  cobro: EstadoCobro;
  cobradoEn: string;
  vence: string;
  iva: string;
  observaciones: string;
};

const inicial = (hoy: string, iva: number | null): Estado => ({ producto: "", cantidad: "", precio: "", fecha: hoy, comprador: "", compradorNuevo: "", cobro: "cobrado", cobradoEn: "", vence: "", iva: coma(iva), observaciones: "" });

/**
 * Ventas sin señal: lo mismo que «Registrar una venta» (qué se vendió, con su unidad y el último precio; cantidad × precio; comprador; si ya pagaron o
 * lo deben; IVA y observaciones) con las listas de la copia de la finca y las mismas reglas (`esquemaVenta`, `revisarVenta`; el servidor las vuelve a
 * aplicar con `guardarVentaCampo`). La leche y los animales no se venden aquí: entran solos desde Leche → Despachos y desde la salida del animal. Un
 * comprador que no está en la lista se escribe y se crea (o se reutiliza) al enviar.
 */
export function VentaCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const dinero = useDinero();
  const v = referencia.ventas;
  const ivaDefecto = referencia.compras.ivaDefecto;
  const [e, setE] = useState<Estado>(() => inicial(hoy, ivaDefecto));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const poner = <K extends keyof Estado>(k: K, valor: Estado[K]) => {
    setE((p) => ({ ...p, [k]: valor }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const elegido = v.productos.find((p) => p.id === e.producto);
  const unidad = elegido?.unidad ?? "";
  const cant = leerNumero(e.cantidad);
  const precioNum = leerNumero(e.precio);
  const total = cant && cant > 0 && precioNum !== null && precioNum >= 0 ? Math.round(cant * precioNum * 100) / 100 : null;
  const hechos = registros.filter((x) => x.tipo === "venta" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const falta = !e.producto ? "Elige qué vendiste." : !(cant && cant > 0) ? "Escribe cuánto vendiste." : precioNum === null ? "Escribe el precio de cada unidad." : null;

  const elegirProducto = (id: string) => {
    const p = v.productos.find((x) => x.id === id);
    setE((prev) => ({ ...prev, producto: id, precio: textoPrecio(p?.precio) }));
    setError(null);
  };

  /** Los mismos campos que «Registrar una venta» con señal (los vacíos no viajan). */
  const campos = (): Record<string, string> => {
    const x: Record<string, string> = {
      fecha: e.fecha, producto_id: e.producto, cantidad: e.cantidad, unidad, precio_unitario: e.precio,
      tercero_id: e.comprador !== NUEVO ? e.comprador : "", comprador_nuevo: e.comprador === NUEVO ? e.compradorNuevo : "",
      cobro: e.cobro, cobrado_en: e.cobro === "cobrado" ? e.cobradoEn : "", cobro_vence: e.cobro === "por_cobrar" ? e.vence : "", iva_tarifa: e.iva, observaciones: e.observaciones,
    };
    return Object.fromEntries(Object.entries(x).filter(([, valor]) => valor.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy, ivaDefecto));
    setVuelta((n) => n + 1);
  };

  const guardar = async () => {
    if (falta) return setError(falta);
    if (e.comprador === NUEVO && !e.compradorNuevo.trim()) return setError("Escribe el nombre del comprador nuevo.");
    const x = campos();
    const d = esquemaVenta.safeParse(x);
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    const problema = revisarVenta(d.data, hoy);
    if (problema) return setError(problema);
    const id = editando?.id ?? crypto.randomUUID();
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "venta", usuarioId, fincaId, animalId: id, etiqueta: `${elegido?.nombre ?? "Venta"} · ${dinero(total)}`, fecha: d.data.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? "Venta guardada" : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    setEditando(r);
    setE({
      producto: x.producto_id ?? "", cantidad: x.cantidad ?? "", precio: x.precio_unitario ?? "", fecha: x.fecha ?? hoy,
      comprador: x.comprador_nuevo ? NUEVO : (x.tercero_id ?? ""), compradorNuevo: x.comprador_nuevo ?? "",
      cobro: (x.cobro as EstadoCobro) ?? "cobrado", cobradoEn: x.cobrado_en ?? "", vence: x.cobro_vence ?? "", iva: x.iva_tarifa ?? "", observaciones: x.observaciones ?? "",
    });
    setVuelta((n) => n + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.ventas) return <Aviso>Tu rol no registra ventas en esta finca.</Aviso>;
  if (v.productos.length === 0) return <Aviso>No hay productos para vender en la lista guardada. Agrégalos con señal en Más → Productos y terceros y vuelve a abrir esta pantalla.</Aviso>;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <p className="text-sm text-humo">La leche y los animales no se registran aquí: entran solos desde Leche → Despachos y desde la salida del animal.</p>

      <SelectorTarjetas<string> titulo="¿Qué vendiste?" valor={e.producto} onCambio={(id) => id && elegirProducto(String(id))} opciones={v.productos.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: textoPorUnidad(p.unidad), escena: ESCENA_LINEA_VENTA[p.linea] }))} />

      {elegido ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta={`Cuántos ${unidad || "unidades"}`}>
              {(id) => <input id={id} value={e.cantidad} onChange={(ev) => poner("cantidad", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 10" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta={precioDeCada(unidad)} ayuda={elegido.precio != null ? "Es el último precio al que vendiste; cámbialo si subió o bajó." : "Solo la primera vez: queda guardado para la próxima."}>
              {(id) => <input id={id} value={e.precio} onChange={(ev) => poner("precio", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 30.000" className={CLASE_INPUT} />}
            </Campo>
          </div>
          {total !== null ? (
            <p className="-mt-2 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
              Total de la venta: <span className="font-display text-lg font-semibold tabular-nums">{dinero(total)}</span>
            </p>
          ) : null}

          <Campo etiqueta="Fecha de la venta">
            {(id) => <input id={id} type="date" value={e.fecha} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
          </Campo>

          <Campo etiqueta="Comprador (opcional)">
            {(id) => (
              <Selector
                id={id}
                valor={e.comprador}
                onCambio={(valor) => poner("comprador", String(valor))}
                titulo="¿A quién se lo vendiste?"
                placeholder="Elegir"
                permitirVacio
                opciones={[...v.compradores.map((t) => ({ valor: t.id, etiqueta: t.nombre })), { valor: NUEVO, etiqueta: "Otro comprador (no está en la lista)", detalle: "Escribes su nombre" }]}
              />
            )}
          </Campo>
          {e.comprador === NUEVO ? (
            <Campo etiqueta="Nombre del comprador" ayuda="Queda en tu lista de compradores al enviar (si ya existe, se usa el mismo).">
              {(id) => <input id={id} value={e.compradorNuevo} onChange={(ev) => poner("compradorNuevo", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          ) : null}

          <SelectorTarjetas<EstadoCobro> titulo="¿Ya te pagaron?" valor={e.cobro} onCambio={(c) => c && poner("cobro", c)} opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: ETIQUETA_COBRO[c], escena: ESCENA_COBRO[c] }))} />
          {e.cobro === "cobrado" ? (
            <Campo etiqueta="Fecha del cobro" ayuda="Si lo dejas en blanco, se toma la fecha de la venta.">
              {(id) => <input id={id} type="date" value={e.cobradoEn} min={e.fecha} max={hoy} onChange={(ev) => poner("cobradoEn", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          ) : (
            <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
              {(id) => <input id={id} type="date" value={e.vence} min={e.fecha} onChange={(ev) => poner("vence", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          )}

          <CampoIva key={vuelta} total={total} inicial={leerNumero(e.iva)} onCambio={(t) => setE((p) => (p.iva === t ? p : { ...p, iva: t }))} />

          <Campo etiqueta="Observaciones (opcional)">
            {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
        </>
      ) : null}

      {falta && e.producto ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={falta !== null}>{editando ? "Guardar corrección" : "Guardar venta"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-ventas-hechas">
          <h2 id="titulo-ventas-hechas" className="font-display text-xl font-semibold">Registradas en este celular · {hechos.length}</h2>
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
