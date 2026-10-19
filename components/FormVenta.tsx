"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorTercero } from "@/components/SelectorTercero";
import { crearVenta, editarVenta } from "@/app/(app)/hato/ventas/actions";
import { ESCENA_COBRO, ESCENA_LINEA_VENTA } from "@/lib/escenas-costos";
import { pesos } from "@/lib/ferias";
import { leerNumero } from "@/lib/numeros";
import { textoPrecio } from "@/lib/productos";
import type { Producto, Tercero, Venta } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type EstadoCobro = "cobrado" | "por_cobrar";
const ETIQUETA_COBRO: Record<EstadoCobro, string> = { cobrado: "Ya me pagaron", por_cobrar: "Me lo deben" };

/**
 * Registrar o corregir una venta de lo que no tiene otro módulo (carne, queso, abono, lana…). Se elige qué se vendió (con su unidad y el último
 * precio), a quién (de la lista de compradores) y si ya se cobró: lo único que se escribe es la cantidad. La leche y los animales vendidos no se
 * registran aquí: entran solos desde Leche → Despachos y desde la baja del animal.
 */
export function FormVenta({ hoy, productos, terceros, venta, solicitud }: { hoy: string; productos: Producto[]; terceros: Tercero[]; venta?: Venta; solicitud?: string }) {
  const editando = Boolean(venta);
  const [estado, enviar, pendiente] = useActionState(editando ? editarVenta : crearVenta, undefined);
  const [, iniciar] = useTransition();
  const [producto, setProducto] = useState(venta?.producto_id ?? "");
  const [cantidad, setCantidad] = useState(coma(venta?.cantidad));
  const [precio, setPrecio] = useState(venta ? textoPrecio(venta.precio_unitario) : "");
  const [fecha, setFecha] = useState(venta?.fecha ?? hoy);
  const [tercero, setTercero] = useState(venta?.tercero_id ?? "");
  const [cobro, setCobro] = useState<EstadoCobro>(venta ? (venta.cobrado_en ? "cobrado" : "por_cobrar") : "cobrado");

  const elegido = productos.find((p) => p.id === producto);
  const unidad = venta?.producto_id === producto && venta?.unidad ? venta.unidad : (elegido?.unidad ?? "");
  const cant = leerNumero(cantidad);
  const precioNum = leerNumero(precio);
  const total = cant && cant > 0 && precioNum !== null && precioNum >= 0 ? Math.round(cant * precioNum * 100) / 100 : null;

  const elegirProducto = (id: string) => {
    setProducto(id);
    const p = productos.find((x) => x.id === id);
    // Se propone el último precio de ese producto; si es otro producto que el de la venta que se corrige, no se arrastra el precio viejo.
    setPrecio(textoPrecio(p?.precio_habitual));
  };

  const falta = !producto ? "Elige qué vendiste." : !(cant && cant > 0) ? "Escribe cuánto vendiste." : precioNum === null ? "Escribe el precio de cada unidad." : null;

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      {venta ? <input type="hidden" name="venta_id" value={venta.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}
      <input type="hidden" name="unidad" value={unidad} />

      <Campo etiqueta="¿Qué vendiste?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="producto_id"
            valor={producto}
            onCambio={(v) => v && elegirProducto(String(v))}
            titulo="Producto vendido"
            opciones={productos.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.unidad ? `Por ${p.unidad.replace(/s$/, "")}` : undefined, escena: ESCENA_LINEA_VENTA[p.linea ?? "otros"] }))}
          />
        )}
      </Campo>

      {elegido ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta={`Cuántos ${unidad || "unidades"}`}>
              {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 10" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta={`Precio de cada ${unidad ? unidad.replace(/s$/, "") : "unidad"}`} ayuda={elegido.precio_habitual != null ? "Es el último precio al que vendiste; cámbialo si subió o bajó." : "Solo la primera vez: queda guardado para la próxima."}>
              {(id) => <input id={id} name="precio_unitario" value={precio} onChange={(e) => setPrecio(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 30.000" className={CLASE_INPUT} />}
            </Campo>
          </div>
          {total !== null ? (
            <p className="-mt-2 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
              Total de la venta: <span className="font-display text-lg font-semibold tabular-nums">{pesos(total)}</span>
            </p>
          ) : null}

          <Campo etiqueta="Fecha de la venta">
            {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
          </Campo>

          <Campo etiqueta="Comprador (opcional)">
            {(id) => <SelectorTercero id={id} nombre="tercero_id" tipo="comprador" terceros={terceros} valor={tercero} onCambio={(v) => setTercero(v)} titulo="¿A quién se lo vendiste?" placeholder="Elegir o agregar" />}
          </Campo>

          <Campo etiqueta="¿Ya te pagaron?">
            {(id) => (
              <SelectorTarjetas
                id={id}
                nombre="cobro"
                valor={cobro}
                onCambio={(v) => v && setCobro(v)}
                titulo="Cobro"
                opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: ETIQUETA_COBRO[c], escena: ESCENA_COBRO[c] }))}
              />
            )}
          </Campo>
          {cobro === "cobrado" ? (
            <Campo etiqueta="Fecha del cobro" ayuda="Si lo dejas en blanco, se toma la fecha de la venta.">
              {(id) => <input id={id} name="cobrado_en" type="date" defaultValue={venta?.cobrado_en ?? ""} min={fecha} max={hoy} className={CLASE_INPUT} />}
            </Campo>
          ) : (
            <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
              {(id) => <input id={id} name="cobro_vence" type="date" defaultValue={venta?.cobro_vence ?? ""} min={fecha} className={CLASE_INPUT} />}
            </Campo>
          )}

          <Campo etiqueta="Observaciones" ayuda="Opcional.">
            {(id) => <textarea id={id} name="observaciones" defaultValue={venta?.observaciones ?? ""} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
        </>
      ) : null}

      {falta && producto ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={Boolean(falta)}>
          {editando ? "Guardar cambios" : "Guardar venta"}
        </Boton>
        <Link href="/hato?vista=ventas" className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
