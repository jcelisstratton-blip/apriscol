"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearMantenimiento, editarMantenimiento } from "@/app/(app)/leche/gestion";
import { ESCENA_MANTENIMIENTO } from "@/lib/escenas-forms-a-leche";
import { ETIQUETA_MANTENIMIENTO, TIPOS_MANTENIMIENTO } from "@/lib/leche-calidad";
import type { MantenimientoOrdeno, TipoMantenimiento } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Registrar o corregir una tarea del equipo de ordeño: lavados, presión de vacío, pulsadores o una revisión. */
export function FormMantenimiento({ hoy, registro, solicitud }: { hoy: string; registro?: MantenimientoOrdeno; solicitud?: string }) {
  const editando = Boolean(registro);
  const [estado, enviar, pendiente] = useActionState(editando ? editarMantenimiento : crearMantenimiento, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoMantenimiento>(registro?.tipo ?? "lavado_alcalino");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {registro ? <input type="hidden" name="mantenimiento_id" value={registro.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="¿Qué se hizo?">
        {(id) => (
          <SelectorTarjetas id={id} nombre="tipo" valor={tipo} onCambio={(v) => v && setTipo(v)} titulo="¿Qué se hizo?" opciones={TIPOS_MANTENIMIENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_MANTENIMIENTO[t], escena: ESCENA_MANTENIMIENTO[t] }))} />
        )}
      </Campo>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={registro?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      {tipo === "presion_vacio" ? (
        <Campo etiqueta="Presión de vacío (kPa)" ayuda="Lo que marca el vacuómetro. Opcional.">
          {(id) => <input id={id} name="presion_kpa" defaultValue={coma(registro?.presion_kpa)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 45" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Equipo" ayuda="Opcional. La ordeñadora, el tanque… si tienes más de uno.">
        {(id) => <input id={id} name="equipo" defaultValue={registro?.equipo ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Responsable" ayuda="Opcional.">
        {(id) => <input id={id} name="responsable" defaultValue={registro?.responsable ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Próxima vez" ayuda="Opcional. Queda marcada en «Frío y equipo» cuando llegue esa fecha.">
        {(id) => <input id={id} name="proxima_fecha" type="date" defaultValue={registro?.proxima_fecha ?? ""} min={hoy} className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={registro?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar registro"}
        </Boton>
        <Link href="/leche?vista=frio" className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
