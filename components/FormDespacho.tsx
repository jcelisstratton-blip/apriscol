"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoIva } from "@/components/CampoIva";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorTercero } from "@/components/SelectorTercero";
import { crearDespacho, editarDespacho } from "@/app/(app)/leche/gestion";
import { AvisoGuardadoLocal } from "@/components/AvisoGuardadoLocal";
import { accionConRespaldo, camposDe, errorDe, quedoEnCelular } from "@/lib/offline/respaldo";
import { litros as fmtLitros } from "@/lib/fechas";
import { ESCENA_DESTINO_LECHE } from "@/lib/escenas-forms-a-leche";
import { ESCENA_COBRO } from "@/lib/escenas-costos";
import { leerNumero } from "@/lib/numeros";
import { DESTINOS_LECHE, ETIQUETA_DESTINO } from "@/lib/leche-calidad";
import type { DespachoLeche, DestinoLeche, Tercero } from "@/lib/tipos";
import { useDinero } from "@/components/ProveedorMoneda";
import { useMoneda } from "@/components/ProveedorMoneda";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Registrar o corregir un despacho de leche: cuánta salió de la finca, para dónde, con qué guía y a qué precio. */
export function FormDespacho({
  hoy,
  despacho,
  solicitud,
  terceros,
  precioHabitual,
  ivaDefecto = null,
}: {
  hoy: string;
  despacho?: DespachoLeche;
  solicitud?: string;
  /** Los compradores de la finca: el comprador se elige de la lista. */
  terceros: Tercero[];
  /** El último precio por litro al que se vendió leche: se propone en un despacho nuevo. */
  precioHabitual?: number | null;
  /** El IVA predeterminado de la finca: se escribe solo en un despacho nuevo. */
  ivaDefecto?: number | null;
}) {
  const moneda = useMoneda();
  const dinero = useDinero();
  const editando = Boolean(despacho);
  // Sin señal: un despacho nuevo queda en el celular (mismo identificador del formulario: nunca se duplica) y se envía solo; una corrección pide
  // intentarlo de nuevo. Nunca se pierde lo escrito.
  const [estado, enviar, pendiente] = useActionState(
    accionConRespaldo(
      editando ? editarDespacho : crearDespacho,
      editando || !solicitud
        ? null
        : (formulario) => {
            const destinoTipo = String(formulario.get("destino_tipo") ?? "") as DestinoLeche;
            return {
              id: solicitud,
              tipo: "despacho",
              animalId: solicitud,
              etiqueta: `Despacho · ${fmtLitros(leerNumero(String(formulario.get("litros") ?? "")) ?? 0)} L · ${ETIQUETA_DESTINO[destinoTipo] ?? "Leche"}`,
              fecha: String(formulario.get("fecha") ?? ""),
              campos: camposDe(formulario, ["client_request_id", "despacho_id"]),
            };
          },
    ),
    undefined,
  );
  const guardadoLocal = quedoEnCelular(estado);
  const error = errorDe(estado);
  const [, iniciar] = useTransition();
  const [destino, setDestino] = useState<DestinoLeche>(despacho?.destino_tipo ?? "queseria");
  const [litros, setLitros] = useState(coma(despacho?.litros));
  const [precio, setPrecio] = useState(despacho ? coma(despacho.precio_litro) : coma(precioHabitual));
  const [tercero, setTercero] = useState(despacho?.tercero_id ?? "");
  const [cobro, setCobro] = useState<"cobrado" | "por_cobrar">(despacho ? (despacho.cobrado_en || !despacho.precio_litro ? "cobrado" : "por_cobrar") : "cobrado");
  const total = (leerNumero(litros) ?? 0) * (leerNumero(precio) ?? 0);

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {despacho ? <input type="hidden" name="despacho_id" value={despacho.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={despacho?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Litros despachados">
        {(id) => (
          <input id={id} name="litros" value={litros} onChange={(e) => setLitros(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" required placeholder="Ej. 120" className={CLASE_INPUT} />
        )}
      </Campo>

      <Campo etiqueta="Destino">
        {(id) => (
          <SelectorTarjetas id={id} nombre="destino_tipo" valor={destino} onCambio={(v) => v && setDestino(v)} titulo="¿A dónde fue la leche?" opciones={DESTINOS_LECHE.map((d) => ({ valor: d, etiqueta: ETIQUETA_DESTINO[d], escena: ESCENA_DESTINO_LECHE[d] }))} />
        )}
      </Campo>

      <Campo etiqueta="Comprador" ayuda="Opcional. La quesería, la planta o la persona: se elige de tu lista o se agrega una vez.">
        {(id) => <SelectorTercero id={id} nombre="tercero_id" tipo="comprador" terceros={terceros} valor={tercero} onCambio={(v) => setTercero(v)} titulo="¿A quién se la vendiste?" placeholder="Elegir o agregar" />}
      </Campo>
      {despacho && !despacho.tercero_id && despacho.comprador ? <p className="-mt-3 text-[0.8125rem] text-humo">Antes escribiste: «{despacho.comprador}». Elígelo de la lista para que quede ordenado.</p> : null}

      <Campo etiqueta="Tanque o lote" ayuda="Opcional. De cuál tanque salió.">
        {(id) => <input id={id} name="tanque" defaultValue={despacho?.tanque ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Guía o factura" ayuda="Opcional.">
        {(id) => <input id={id} name="guia" defaultValue={despacho?.guia ?? ""} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta={`Precio por litro (${moneda.simbolo})`} ayuda="Opcional.">
        {(id) => (
          <input id={id} name="precio_litro" value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 2500" className={CLASE_INPUT} />
        )}
      </Campo>
      {total > 0 ? <p className="-mt-2 text-sm font-semibold">Valor del despacho: {dinero(total)}</p> : null}
      {total > 0 ? <CampoIva total={total} inicial={despacho ? despacho.iva_tarifa : ivaDefecto} /> : null}

      {total > 0 ? (
        <>
          <Campo etiqueta="¿Ya te pagaron?">
            {(id) => (
              <SelectorTarjetas
                id={id}
                nombre="cobro"
                valor={cobro}
                onCambio={(v) => v && setCobro(v)}
                titulo="Cobro"
                opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: c === "cobrado" ? "Ya me pagaron" : "Me lo deben", escena: ESCENA_COBRO[c] }))}
              />
            )}
          </Campo>
          {cobro === "por_cobrar" ? (
            <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
              {(id) => <input id={id} name="cobro_vence" type="date" defaultValue={despacho?.cobro_vence ?? ""} className={CLASE_INPUT} />}
            </Campo>
          ) : null}
        </>
      ) : null}

      <Campo etiqueta="Temperatura al despachar (°C)" ayuda="Opcional.">
        {(id) => <input id={id} name="temperatura_c" defaultValue={coma(despacho?.temperatura_c)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 5" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={despacho?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {guardadoLocal ? <AvisoGuardadoLocal /> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={guardadoLocal}>
          {guardadoLocal ? "Guardado en el celular" : editando ? "Guardar cambios" : "Guardar despacho"}
        </Boton>
        <Link href="/leche?vista=despachos" className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
