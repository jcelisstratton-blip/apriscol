"use client";

import { useState } from "react";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { DETALLE_FORMA_PAGO, DETALLE_VINCULACION, ETIQUETA_FORMA_PAGO, ETIQUETA_VINCULACION, formasDe, UNIDAD_PAGO, VINCULACIONES } from "@/lib/nomina";
import { ESCENA_ACTIVA, ESCENA_FORMA_PAGO, ESCENA_VINCULACION } from "@/lib/escenas-costos";
import { textoPrecio } from "@/lib/productos";
import type { FormaPago, Persona, Vinculacion } from "@/lib/tipos";

/**
 * Los campos del contrato de una persona: nombre, cargo (si no hay perfil que lo defina), cómo está vinculada, cómo y cuánto se le paga, y desde cuándo. Los usan el formulario de
 * invitar (aparecen al elegir el rol) y el de corregir a una persona (con su estado y observaciones). No se pide documento de identidad.
 */
export function CamposContrato({
  hoy,
  persona,
  tienePagos = false,
  conEstado = false,
  nombreSugerido,
  perfil,
}: {
  hoy: string;
  persona?: Persona;
  tienePagos?: boolean;
  /** Al corregir: si sigue trabajando, fecha de retiro y observaciones. */
  conEstado?: boolean;
  nombreSugerido?: string;
  /** Los datos propios del perfil (`CamposPerfil`): van justo después del nombre, antes del contrato. Con perfil el cargo no se pregunta: sale del perfil. */
  perfil?: React.ReactNode;
}) {
  const [vinculacion, setVinculacion] = useState<Vinculacion>(persona?.vinculacion ?? "laboral");
  const [forma, setForma] = useState<FormaPago>(persona?.forma_pago ?? "mensual");
  const [activo, setActivo] = useState<"si" | "no">(persona && !persona.activo ? "no" : "si");

  const cambiarVinculacion = (v: Vinculacion) => {
    setVinculacion(v);
    // Con contrato de trabajo no se paga «por servicio».
    if (!formasDe(v).includes(forma)) setForma("mensual");
  };

  return (
    <>
      <Campo etiqueta="Nombre">
        {(id) => <input id={id} name="nombre" defaultValue={persona?.nombre ?? nombreSugerido ?? ""} required maxLength={120} autoComplete="off" enterKeyHint="next" placeholder="Ej. Ana Gómez" className={CLASE_INPUT} />}
      </Campo>
      {perfil ? null : (
        <Campo etiqueta="Cargo (opcional)">
          {(id) => <input id={id} name="cargo" defaultValue={persona?.cargo ?? ""} maxLength={60} autoComplete="off" enterKeyHint="next" placeholder="Ej. Ordeñadora, veterinario, jornalero" className={CLASE_INPUT} />}
        </Campo>
      )}

      {perfil}

      <Campo etiqueta="¿Cómo está vinculada?" ayuda={tienePagos ? "Ya tiene pagos registrados, por eso no se puede cambiar." : undefined}>
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="vinculacion"
            valor={vinculacion}
            onCambio={(v) => v && cambiarVinculacion(v)}
            titulo="Vinculación"
            deshabilitado={tienePagos}
            opciones={VINCULACIONES.map((v) => ({ valor: v, etiqueta: ETIQUETA_VINCULACION[v], detalle: DETALLE_VINCULACION[v], escena: ESCENA_VINCULACION[v] }))}
          />
        )}
      </Campo>

      <Campo etiqueta="¿Cómo se le paga?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="forma_pago"
            valor={forma}
            onCambio={(v) => v && setForma(v)}
            titulo="Forma de pago"
            opciones={formasDe(vinculacion).map((f) => ({ valor: f, etiqueta: ETIQUETA_FORMA_PAGO[f], detalle: DETALLE_FORMA_PAGO[f], escena: ESCENA_FORMA_PAGO[f] }))}
          />
        )}
      </Campo>

      <Campo etiqueta={UNIDAD_PAGO[forma].valor} ayuda="Es lo que recibe la persona. Los pagos se calculan con este valor y puedes ajustarlo en cada pago.">
        {(id) => <input id={id} name="valor_base" defaultValue={persona ? textoPrecio(persona.valor_base) : ""} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 1.500.000" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Fecha de ingreso (opcional)">
        {(id) => <input id={id} name="fecha_ingreso" type="date" defaultValue={persona?.fecha_ingreso ?? ""} max={hoy} className={CLASE_INPUT} />}
      </Campo>

      {conEstado ? (
        <>
          <Campo etiqueta="¿Sigue trabajando en la finca?">
            {(id) => (
              <SelectorTarjetas
                id={id}
                nombre="activo"
                valor={activo}
                onCambio={(v) => v && setActivo(v)}
                titulo="Estado"
                opciones={[
                  { valor: "si", etiqueta: "Sí, sigue", escena: ESCENA_ACTIVA.si },
                  { valor: "no", etiqueta: "Ya se retiró", detalle: "Su historial de pagos se conserva", escena: ESCENA_ACTIVA.no },
                ]}
              />
            )}
          </Campo>
          {activo === "no" ? (
            <Campo etiqueta="Fecha de retiro">
              {(id) => <input id={id} name="fecha_retiro" type="date" defaultValue={persona?.fecha_retiro ?? ""} max={hoy} required className={CLASE_INPUT} />}
            </Campo>
          ) : null}
          <Campo etiqueta="Observaciones" ayuda="Opcional.">
            {(id) => <textarea id={id} name="observaciones" defaultValue={persona?.observaciones ?? ""} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
        </>
      ) : null}
    </>
  );
}
