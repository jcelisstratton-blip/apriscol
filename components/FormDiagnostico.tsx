"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearDiagnostico, editarDiagnostico } from "@/app/(app)/reproduccion/actions";
import { formatoFecha } from "@/lib/fechas";
import { ESCENA_METODO_DIAGNOSTICO, ESCENA_RESULTADO_DIAGNOSTICO } from "@/lib/escenas-forms-b-reproduccion";
import { ETIQUETA_METODO, ETIQUETA_RESULTADO, METODOS_DIAGNOSTICO, RESULTADOS_DIAGNOSTICO } from "@/lib/reproduccion";
import type { DiagnosticoGestacion, MetodoDiagnostico, ResultadoDiagnostico } from "@/lib/tipos";

/** Registrar o corregir un diagnóstico de gestación. Va ligado al último servicio de la hembra (si lo hay). */
export function FormDiagnostico({
  hembraId,
  hoy,
  servicio,
  diagnostico,
}: {
  hembraId: string;
  hoy: string;
  /** El servicio al que corresponde: el último de la hembra al crear, o el que ya tenía al editar. */
  servicio?: { id: string; fecha: string } | null;
  diagnostico?: DiagnosticoGestacion;
}) {
  const editando = Boolean(diagnostico);
  const [estado, enviar, pendiente] = useActionState(editando ? editarDiagnostico : crearDiagnostico, undefined);
  const [, iniciar] = useTransition();
  const [metodo, setMetodo] = useState<MetodoDiagnostico>(diagnostico?.metodo ?? "ecografia");
  const [resultado, setResultado] = useState<ResultadoDiagnostico>(diagnostico?.resultado ?? "gestante");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="hembra_id" value={hembraId} />
      {servicio ? <input type="hidden" name="servicio_id" value={servicio.id} /> : null}
      {diagnostico ? <input type="hidden" name="diagnostico_id" value={diagnostico.id} /> : null}

      {servicio ? (
        <Aviso tipo="info">Corresponde al servicio del {formatoFecha(servicio.fecha)}.</Aviso>
      ) : (
        <Aviso tipo="atencion">Esta hembra no tiene un servicio registrado. Registra primero el servicio para que el diagnóstico quede ligado a él.</Aviso>
      )}

      <Campo etiqueta="Fecha del diagnóstico">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={diagnostico?.fecha ?? hoy} min={servicio?.fecha} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="¿Cómo se hizo?">
        {(id) => <SelectorTarjetas id={id} nombre="metodo" valor={metodo} onCambio={(v) => v && setMetodo(v)} titulo="¿Cómo se hizo?" opciones={METODOS_DIAGNOSTICO.map((m) => ({ valor: m, etiqueta: ETIQUETA_METODO[m], escena: ESCENA_METODO_DIAGNOSTICO[m] }))} />}
      </Campo>

      <Campo etiqueta="Resultado" ayuda="Si no se pudo saber, déjalo en «Dudoso» y repítelo después.">
        {(id) => <SelectorTarjetas id={id} nombre="resultado" valor={resultado} onCambio={(v) => v && setResultado(v)} titulo="Resultado" opciones={RESULTADOS_DIAGNOSTICO.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO[r], escena: ESCENA_RESULTADO_DIAGNOSTICO[r] }))} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={diagnostico?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar diagnóstico"}
        </Boton>
        <Link href={`/hato/${hembraId}#reproduccion`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
