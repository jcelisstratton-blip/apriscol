"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { crearFamacha, editarFamacha } from "@/app/(app)/sanidad/actions";
import { FAMACHA, PUNTAJES_FAMACHA } from "@/lib/famacha";
import type { EvaluacionFamacha } from "@/lib/tipos";

const COLOR_PUNTO = { ok: "bg-ok text-white", neutro: "bg-arena text-tinta", aviso: "bg-ambar text-white", alerta: "bg-rojo text-white" } as const;

/** Registrar la evaluación FAMACHA de un animal (viene fijo desde su ficha) o corregir una ya registrada. */
export function FormFamacha({ animalId, hoy, evaluacion }: { animalId: string; hoy: string; evaluacion?: EvaluacionFamacha }) {
  const editando = Boolean(evaluacion);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFamacha : crearFamacha, undefined);
  const [, iniciar] = useTransition();
  const [puntaje, setPuntaje] = useState<number | null>(evaluacion?.puntaje ?? null);

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const elegido = puntaje ? FAMACHA[puntaje] : null;

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      {evaluacion ? <input type="hidden" name="evaluacion_id" value={evaluacion.id} /> : null}
      <input type="hidden" name="puntaje" value={puntaje ?? ""} />

      <div className="space-y-2">
        <p className="text-sm font-semibold" id="famacha-titulo">Color de la mucosa del ojo</p>
        <p className="text-[0.8125rem] text-humo">Baja el párpado inferior y compara el color con la tarjeta FAMACHA.</p>
        <div role="radiogroup" aria-labelledby="famacha-titulo" className="grid grid-cols-1 gap-2">
          {PUNTAJES_FAMACHA.map((n) => {
            const f = FAMACHA[n];
            const activo = puntaje === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setPuntaje(n)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition ${activo ? "bg-musgo/10 ring-2 ring-musgo" : "bg-papel ring-arena hover:bg-lana"}`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${COLOR_PUNTO[f.tono]}`}>{n}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{f.color}</span>
                  <span className="block text-sm text-humo">{f.texto}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {elegido ? <Aviso tipo={elegido.tono === "alerta" ? "atencion" : "info"}>{elegido.accion}</Aviso> : null}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={evaluacion?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional: condición corporal, diarrea, si está recién parida…">
        {(id) => <textarea id={id} name="observaciones" defaultValue={evaluacion?.observaciones ?? ""} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {!puntaje ? <Aviso tipo="atencion">Elige el puntaje (1 a 5) para guardar.</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={!puntaje}>
          {editando ? "Guardar cambios" : "Guardar evaluación"}
        </Boton>
        <Link href={`/hato/${animalId}#sanidad`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
