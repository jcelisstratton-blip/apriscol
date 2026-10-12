"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { crearAnalisis, editarAnalisis } from "@/app/(app)/leche/gestion";
import { RCS_BUENO } from "@/lib/leche-calidad";
import type { AnalisisLeche } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Registrar o corregir un análisis de calidad de la leche (grasa, proteína, células somáticas). Si viene `animalId` es de ese animal
 * (se registra desde su ficha); si no, es de la leche mezclada (un tanque o un lote). El CMT de un animal vive en Sanidad → Pruebas.
 */
export function FormCalidad({
  hoy,
  animalId,
  analisis,
  solicitud,
  cancelar,
}: {
  hoy: string;
  animalId?: string;
  analisis?: AnalisisLeche;
  solicitud?: string;
  cancelar: string;
}) {
  const editando = Boolean(analisis);
  const [estado, enviar, pendiente] = useActionState(editando ? editarAnalisis : crearAnalisis, undefined);
  const [, iniciar] = useTransition();
  const animal = animalId ?? analisis?.animal_id ?? undefined;

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {animal ? <input type="hidden" name="animal_id" value={animal} /> : null}
      {analisis ? <input type="hidden" name="analisis_id" value={analisis.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={analisis?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      {!animal ? (
        <Campo etiqueta="Muestra" ayuda="Opcional. Qué leche se analizó: «Tanque general», «Lote del lunes»…">
          {(id) => <input id={id} name="muestra" defaultValue={analisis?.muestra ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Grasa (%)">
          {(id) => <input id={id} name="grasa_pct" defaultValue={coma(analisis?.grasa_pct)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 3,6" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Proteína (%)">
          {(id) => <input id={id} name="proteina_pct" defaultValue={coma(analisis?.proteina_pct)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 3,2" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta="Células somáticas (miles por ml)" ayuda={`Indicador de la salud de la ubre. Hasta ${RCS_BUENO.toLocaleString("es-CO")} se considera bajo; tu comprador puede pedir otro límite.`}>
        {(id) => <input id={id} name="rcs_miles_ml" defaultValue={coma(analisis?.rcs_miles_ml)} inputMode="numeric" autoComplete="off" enterKeyHint="next" placeholder="Ej. 850" className={CLASE_INPUT} />}
      </Campo>
      <p className="-mt-2 text-[0.8125rem] text-humo">Llena al menos un resultado.</p>

      <Campo etiqueta="Laboratorio" ayuda="Opcional.">
        {(id) => <input id={id} name="laboratorio" defaultValue={analisis?.laboratorio ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={analisis?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar análisis"}
        </Boton>
        <Link href={cancelar} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
