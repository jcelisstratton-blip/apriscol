"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Insignia } from "@/components/Insignia";
import { Selector } from "@/components/Selector";
import { crearFrio, editarFrio } from "@/app/(app)/leche/gestion";
import { leerNumero } from "@/lib/numeros";
import { estadoTemperatura, ETIQUETA_MOMENTO_FRIO, FRIO_MAX, FRIO_MIN, MOMENTOS_FRIO } from "@/lib/leche-calidad";
import type { ControlFrio, MomentoFrio } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Registrar o corregir una medición de temperatura de la leche (cadena de frío). */
export function FormFrio({ hoy, control, solicitud }: { hoy: string; control?: ControlFrio; solicitud?: string }) {
  const editando = Boolean(control);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFrio : crearFrio, undefined);
  const [, iniciar] = useTransition();
  const [momento, setMomento] = useState<MomentoFrio>(control?.momento ?? "tras_ordeno");
  const [temperatura, setTemperatura] = useState(coma(control?.temperatura_c));
  const valor = leerNumero(temperatura);
  const lectura = valor !== null ? estadoTemperatura(valor) : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {control ? <input type="hidden" name="control_id" value={control.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Fecha">
          {(id) => <input id={id} name="fecha" type="date" defaultValue={control?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Hora" ayuda="Opcional.">
          {(id) => <input id={id} name="hora" type="time" defaultValue={control?.hora?.slice(0, 5) ?? ""} className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta="¿Cuándo se midió?">
        {(id) => (
          <Selector id={id} nombre="momento" valor={momento} onCambio={(v) => v && setMomento(v)} titulo="¿Cuándo se midió?" opciones={MOMENTOS_FRIO.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOMENTO_FRIO[m] }))} />
        )}
      </Campo>

      <Campo etiqueta="Temperatura (°C)" ayuda={`Lo ideal es de ${FRIO_MIN} a ${FRIO_MAX} °C.`}>
        {(id) => (
          <input id={id} name="temperatura_c" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" required placeholder="Ej. 4,5" className={CLASE_INPUT} />
        )}
      </Campo>
      {lectura ? (
        <p className="-mt-2">
          <Insignia tono={lectura.tono}>{lectura.texto}</Insignia>
        </p>
      ) : null}

      <Campo etiqueta="Tanque o equipo" ayuda="Opcional. Si tienes más de uno.">
        {(id) => <input id={id} name="equipo" defaultValue={control?.equipo ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={control?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar medición"}
        </Boton>
        <Link href="/leche?vista=frio" className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
