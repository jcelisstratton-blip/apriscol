"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SubirSoporte } from "@/components/SubirSoporte";
import { crearPago, editarPago } from "@/app/(app)/personal/actions";
import { ESCENA_PAGO } from "@/lib/escenas-costos";
import { pesos } from "@/lib/ferias";
import { ETIQUETA_FORMA_PAGO, calcularPago, UNIDAD_PAGO } from "@/lib/nomina";
import { leerNumero } from "@/lib/numeros";
import { textoPrecio } from "@/lib/productos";
import type { PagoPersonal, Persona } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type EstadoPago = "pagado" | "por_pagar";
const ETIQUETA_PAGO: Record<EstadoPago, string> = { pagado: "Ya se pagó", por_pagar: "Por pagar" };
const textoFactor = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

/**
 * Registrar o corregir un pago al personal. Se elige a la persona y el valor viene de su contrato: lo único que se escribe es cuántos meses, días o
 * servicios se pagan. Muestra lo que recibe la persona y lo que le cuesta a la finca (con el factor prestacional de Ajustes si tiene contrato de trabajo).
 * A quien está por prestación de servicios se le pide el comprobante de pago de su seguridad social (PILA) para registrar el pago como hecho.
 */
export function FormPagoPersonal({ hoy, personal, factor, pago, solicitud, personaInicial }: { hoy: string; personal: Persona[]; factor: number; pago?: PagoPersonal; solicitud?: string; personaInicial?: string }) {
  const editando = Boolean(pago);
  const [estado, enviar, pendiente] = useActionState(editando ? editarPago : crearPago, undefined);
  const [, iniciar] = useTransition();
  const inicial = personaInicial ? personal.find((p) => p.id === personaInicial) : undefined;
  const [personaId, setPersonaId] = useState(pago?.personal_id ?? inicial?.id ?? "");
  const [cantidad, setCantidad] = useState(pago ? coma(pago.cantidad) : inicial?.forma_pago === "mensual" ? "1" : "");
  const [valor, setValor] = useState(pago ? textoPrecio(pago.valor_base) : textoPrecio(inicial?.valor_base));
  const [fecha, setFecha] = useState(pago?.fecha ?? hoy);
  const [cobro, setCobro] = useState<EstadoPago>(pago ? (pago.pagado_en ? "pagado" : "por_pagar") : "pagado");
  const [pila, setPila] = useState(pago?.soporte_pila ?? "");
  const [subiendo, setSubiendo] = useState(false);

  const persona = personal.find((p) => p.id === personaId);
  const unidad = persona ? UNIDAD_PAGO[persona.forma_pago] : null;
  // Si se corrige un pago de la misma persona, vale el factor con que se registró; si no, el actual de los ajustes.
  const factorAplicado = !persona || persona.vinculacion === "servicios" ? 1 : pago && pago.personal_id === persona.id ? pago.factor : factor;
  const cant = leerNumero(cantidad);
  const valorNum = leerNumero(valor);
  const montos = cant && cant > 0 && valorNum !== null && valorNum >= 0 ? calcularPago(cant, valorNum, factorAplicado) : null;
  const exigePila = persona?.vinculacion === "servicios";

  const elegirPersona = (id: string) => {
    setPersonaId(id);
    const p = personal.find((x) => x.id === id);
    // Se propone el valor del contrato; al corregir un pago de la misma persona se respeta el que se aplicó.
    setValor(pago && pago.personal_id === id ? textoPrecio(pago.valor_base) : textoPrecio(p?.valor_base));
    if (!pago) setCantidad(p?.forma_pago === "mensual" ? "1" : "");
  };

  const falta = !personaId
    ? "Elige a quién le pagaste."
    : !(cant && cant > 0)
      ? `Escribe cuántos ${unidad?.plural ?? "meses"} se pagan.`
      : valorNum === null
        ? "Escribe cuánto vale cada uno."
        : cobro === "pagado" && exigePila && !pila
          ? "Adjunta el comprobante de pago de la seguridad social (PILA), o déjalo como «Por pagar»."
          : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      {pago ? <input type="hidden" name="pago_id" value={pago.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="¿A quién le pagaste?">
        {(id) => (
          <Selector
            id={id}
            nombre="personal_id"
            valor={personaId}
            onCambio={(v) => v && elegirPersona(String(v))}
            titulo="Persona"
            placeholder="Elegir"
            opciones={personal.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: [p.cargo, ETIQUETA_FORMA_PAGO[p.forma_pago]].filter(Boolean).join(" · ") }))}
          />
        )}
      </Campo>

      {persona && unidad ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta={`Cuántos ${unidad.plural}`}>
              {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 1" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta={`Valor de cada ${unidad.singular}`} ayuda="Viene de su contrato; cámbialo solo si este pago fue distinto.">
              {(id) => <input id={id} name="valor_base" value={valor} onChange={(e) => setValor(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 1.500.000" className={CLASE_INPUT} />}
            </Campo>
          </div>

          {montos ? (
            <div className="-mt-2 space-y-1 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
              <p>
                Recibe: <span className="font-display text-lg font-semibold tabular-nums">{pesos(montos.pago)}</span>
              </p>
              {persona.vinculacion === "laboral" ? (
                <p className="text-humo">
                  Con las cargas de ley (×{textoFactor(factorAplicado)}) le cuesta a la finca <span className="font-semibold tabular-nums text-tinta">{pesos(montos.costo)}</span>.
                </p>
              ) : (
                <p className="text-humo">Por prestación de servicios, le cuesta a la finca lo mismo: la persona paga su propia seguridad social.</p>
              )}
            </div>
          ) : null}

          <Campo etiqueta="Fecha del pago">
            {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
          </Campo>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta="Periodo: desde (opcional)">
              {(id) => <input id={id} name="periodo_desde" type="date" defaultValue={pago?.periodo_desde ?? ""} className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Periodo: hasta (opcional)">
              {(id) => <input id={id} name="periodo_hasta" type="date" defaultValue={pago?.periodo_hasta ?? ""} className={CLASE_INPUT} />}
            </Campo>
          </div>

          <Campo etiqueta="¿Ya se pagó?">
            {(id) => (
              <SelectorTarjetas
                id={id}
                nombre="pago"
                valor={cobro}
                onCambio={(v) => v && setCobro(v)}
                titulo="Pago"
                opciones={(["pagado", "por_pagar"] as const).map((c) => ({ valor: c, etiqueta: ETIQUETA_PAGO[c], escena: ESCENA_PAGO[c] }))}
              />
            )}
          </Campo>
          {cobro === "pagado" ? (
            <Campo etiqueta="Fecha en que se pagó" ayuda="Si lo dejas en blanco, se toma la fecha del pago.">
              {(id) => <input id={id} name="pagado_en" type="date" defaultValue={pago?.pagado_en ?? ""} min={fecha} max={hoy} className={CLASE_INPUT} />}
            </Campo>
          ) : null}

          {exigePila ? (
            <Campo etiqueta="Comprobante de seguridad social (PILA)" ayuda="Quien trabaja por prestación de servicios paga su propia seguridad social. Para registrar el pago como hecho, adjunta su comprobante.">
              {() => <SubirSoporte nombre="soporte_pila" carpeta="nomina" etiqueta="Comprobante de pago de seguridad social" inicial={pago?.soporte_pila} onEstado={setSubiendo} onCambio={setPila} />}
            </Campo>
          ) : null}

          <Campo etiqueta="Observaciones" ayuda="Opcional.">
            {(id) => <textarea id={id} name="observaciones" defaultValue={pago?.observaciones ?? ""} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
        </>
      ) : null}

      {falta && personaId ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={Boolean(falta) || subiendo}>
          {editando ? "Guardar cambios" : "Guardar pago"}
        </Boton>
        <Link href="/mas/miembros?vista=pagos" className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
