"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { OjoFamacha } from "@/components/OjoFamacha";
import { FAMACHA, GUIA_FAMACHA, PUNTAJES_FAMACHA } from "@/lib/famacha";

/** «¿Cómo evaluar bien?»: la escala de los cinco colores, los pasos para revisar el ojo y las notas que la acompañan. */
export function GuiaFamacha() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline"
      >
        <CircleHelp className="size-5" strokeWidth={1.9} aria-hidden="true" /> ¿Cómo evaluar bien?
      </button>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Cómo leer el FAMACHA">
        <div className="space-y-5">
          <p className="text-[0.9375rem] text-humo">
            El color del párpado de abajo muestra si el animal tiene anemia por parásitos y ayuda a decidir a quién desparasitar.
          </p>

          <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
            {PUNTAJES_FAMACHA.map((n) => (
              <div key={n} className="min-w-0 text-center">
                <OjoFamacha puntaje={n} className="w-full" />
                <span className="mt-1 block font-display text-base font-semibold">{n}</span>
              </div>
            ))}
          </div>

          <ul className="space-y-3">
            {PUNTAJES_FAMACHA.map((n) => (
              <li key={n} className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-arena font-display font-semibold">{n}</span>
                <span className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                  <span className="block font-semibold">
                    {FAMACHA[n].color} · {FAMACHA[n].texto}
                  </span>
                  <span className="block text-humo">{FAMACHA[n].detalle}</span>
                  <span className="block"><span className="font-semibold">Qué hacer: </span>{FAMACHA[n].accion}</span>
                </span>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-2 font-semibold">Cómo revisar el ojo</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-humo marker:font-semibold marker:text-tinta">
              {GUIA_FAMACHA.pasos.map((p) => (
                <li key={p} className="[overflow-wrap:anywhere]">{p}</li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-2 font-semibold">Para tener en cuenta</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] text-humo">
              {GUIA_FAMACHA.notas.map((p) => (
                <li key={p} className="[overflow-wrap:anywhere]">{p}</li>
              ))}
            </ul>
          </div>

          <p className="text-[0.8125rem] text-humo">Los colores de las ilustraciones son una referencia: la luz y cada animal pueden cambiar el tono.</p>
        </div>
      </Sheet>
    </>
  );
}
