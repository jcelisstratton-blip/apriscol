"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Insignia } from "@/components/Insignia";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { Selector } from "@/components/Selector";
import { SubirSoporte } from "@/components/SubirSoporte";
import { crearAnalisis, editarAnalisis } from "@/app/(app)/leche/gestion";
import { CRIOSCOPIA_MAX, CRIOSCOPIA_MIN, estadoCrioscopia, ETIQUETA_RESIDUOS, RCS_BUENO, RESIDUOS } from "@/lib/leche-calidad";
import { leerNumero } from "@/lib/numeros";
import type { AnalisisLeche, ResiduosAntibioticos } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Registrar o corregir un análisis de calidad de la leche. Si viene `animalId` es de ese animal (se registra desde su ficha): composición y
 * células somáticas. Si no, es de la leche mezclada (un tanque o un lote) y suma la pureza (crioscopia) y los residuos de antibióticos.
 * El documento con los resultados se adjunta aquí (obligatorio al crear): es la prueba que se muestra a quien la pida. El CMT de un
 * animal vive en Sanidad → Pruebas.
 */
export function FormCalidad({
  hoy,
  animalId,
  analisis,
  solicitud,
  cancelar,
  volver,
}: {
  hoy: string;
  animalId?: string;
  analisis?: AnalisisLeche;
  solicitud?: string;
  cancelar: string;
  /** Si el análisis se crea desde los controles de un despacho, a dónde volver al guardarlo. */
  volver?: string;
}) {
  const editando = Boolean(analisis);
  const [estado, enviar, pendiente] = useActionState(editando ? editarAnalisis : crearAnalisis, undefined);
  const [, iniciar] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const animal = animalId ?? analisis?.animal_id ?? undefined;
  const [crio, setCrio] = useState(coma(analisis?.crioscopia_c));
  const [residuos, setResiduos] = useState<ResiduosAntibioticos | "">(analisis?.residuos_antibioticos ?? "");
  const valorCrio = leerNumero(crio);
  const lecturaCrio = valorCrio !== null && valorCrio !== 0 ? estadoCrioscopia(-Math.abs(valorCrio)) : null;

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {animal ? <input type="hidden" name="animal_id" value={animal} /> : null}
      {volver ? <input type="hidden" name="volver" value={volver} /> : null}
      {analisis ? <input type="hidden" name="analisis_id" value={analisis.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      {!editando ? <PorQueAnalizar linea="leche" /> : null}

      <Campo etiqueta="Fecha del análisis">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={analisis?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      {!animal ? (
        <Campo etiqueta="Muestra" ayuda="Opcional. Qué leche se analizó: «Tanque general», «Lote del lunes»…">
          {(id) => <input id={id} name="muestra" defaultValue={analisis?.muestra ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <fieldset className="space-y-4 rounded-2xl bg-papel p-4 ring-1 ring-arena">
        <legend className="px-1 text-sm font-bold">Composición</legend>
        <p className="-mt-1 text-[0.8125rem] text-humo">Con un analizador de leche (ultrasonido o infrarrojo). Llena lo que te dé el informe.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Grasa (%)">
            {(id) => <input id={id} name="grasa_pct" defaultValue={coma(analisis?.grasa_pct)} inputMode="decimal" autoComplete="off" placeholder="Ej. 3,6" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Proteína (%)">
            {(id) => <input id={id} name="proteina_pct" defaultValue={coma(analisis?.proteina_pct)} inputMode="decimal" autoComplete="off" placeholder="Ej. 3,2" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Sólidos totales (%)">
            {(id) => <input id={id} name="solidos_totales_pct" defaultValue={coma(analisis?.solidos_totales_pct)} inputMode="decimal" autoComplete="off" placeholder="Ej. 12,5" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Lactosa (%)">
            {(id) => <input id={id} name="lactosa_pct" defaultValue={coma(analisis?.lactosa_pct)} inputMode="decimal" autoComplete="off" placeholder="Ej. 4,4" className={CLASE_INPUT} />}
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl bg-papel p-4 ring-1 ring-arena">
        <legend className="px-1 text-sm font-bold">Sanidad de la ubre</legend>
        <Campo etiqueta="Células somáticas (miles por ml)" ayuda={`Se mide en laboratorio. Hasta ${RCS_BUENO.toLocaleString("es-CO")} se considera bajo; tu comprador puede pedir otro límite.`}>
          {(id) => <input id={id} name="rcs_miles_ml" defaultValue={coma(analisis?.rcs_miles_ml)} inputMode="numeric" autoComplete="off" placeholder="Ej. 850" className={CLASE_INPUT} />}
        </Campo>
      </fieldset>

      {!animal ? (
        <fieldset className="space-y-4 rounded-2xl bg-papel p-4 ring-1 ring-arena">
          <legend className="px-1 text-sm font-bold">Pureza e inocuidad</legend>
          <Campo
            etiqueta="Crioscopia: punto de congelación (°C)"
            ayuda={`La leche pura congela entre ${CRIOSCOPIA_MIN.toLocaleString("es-CO")} y ${CRIOSCOPIA_MAX.toLocaleString("es-CO")} °C; más cerca de cero puede ser agua añadida.`}
          >
            {(id) => <input id={id} name="crioscopia_c" value={crio} onChange={(e) => setCrio(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. -0,535" className={CLASE_INPUT} />}
          </Campo>
          {lecturaCrio ? (
            <p className="-mt-2">
              <Insignia tono={lecturaCrio.tono}>{lecturaCrio.texto}</Insignia>
            </p>
          ) : null}
          <Campo etiqueta="Residuos de antibióticos" ayuda="Con tiras reactivas o inhibición microbiana, antes de despachar. Si da positivo, esa leche no se despacha.">
            {(id) => (
              <Selector
                id={id}
                nombre="residuos_antibioticos"
                valor={residuos}
                onCambio={setResiduos}
                titulo="Residuos de antibióticos"
                placeholder="No se midió"
                permitirVacio
                opciones={RESIDUOS.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESIDUOS[r] }))}
              />
            )}
          </Campo>
        </fieldset>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Documento con los resultados{editando ? "" : " (obligatorio)"}</p>
        <p className="text-[0.8125rem] text-humo">
          El informe del laboratorio o la foto de la prueba. Es la prueba que le muestras a quien te la pida; sin él, este análisis no sirve de respaldo para un despacho.
        </p>
        <SubirSoporte nombre="soporte_path" carpeta="calidad" etiqueta="Documento con los resultados" inicial={analisis?.soporte_path} onEstado={setSubiendo} />
      </div>

      <Campo etiqueta="Laboratorio" ayuda="Opcional.">
        {(id) => <input id={id} name="laboratorio" defaultValue={analisis?.laboratorio ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={analisis?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={subiendo}>
          {editando ? "Guardar cambios" : "Guardar análisis"}
        </Boton>
        <Link href={cancelar} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
