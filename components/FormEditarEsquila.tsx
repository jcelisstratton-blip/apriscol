"use client";

import { useActionState, useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { ListaEscalable } from "@/components/ListaEscalable";
import { actualizarEsquila } from "@/app/(app)/esquila/actions";

export type OvejaDeEsquila = { id: string; numero_arete: string; nombre: string | null; peso: number | null };

/**
 * Corregir una esquila: la fecha, quién esquiló, el costo, las notas y los kilos de cada oveja. Las ovejas no se cambian aquí
 * (si se equivocó de ovejas, se anula y se registra otra): se muestran con la razón.
 */
export function FormEditarEsquila({
  esquila,
  ovejas,
  hoy,
}: {
  esquila: { id: string; fecha: string; esquilador: string | null; costo: number | null; notas: string | null };
  ovejas: OvejaDeEsquila[];
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState(actualizarEsquila, undefined);
  const [, iniciar] = useTransition();
  const [pesos, setPesos] = useState<Record<string, string>>(() => Object.fromEntries(ovejas.map((o) => [o.id, o.peso == null ? "" : String(o.peso).replace(".", ",")])));
  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: ovejas.slice(desde, desde + cantidad), total: ovejas.length }), [ovejas]);

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    for (const o of ovejas) {
      datos.append("animal_id", o.id);
      datos.set(`peso_${o.id}`, pesos[o.id] ?? "");
    }
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6 lg:max-w-2xl">
      <input type="hidden" name="esquila_id" value={esquila.id} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Campo etiqueta="Fecha de la esquila">
          {(id) => <input id={id} type="date" name="fecha" defaultValue={esquila.fecha} max={hoy} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="¿Quién esquiló?" ayuda="Opcional.">
          {(id) => <input id={id} name="esquilador" defaultValue={esquila.esquilador ?? ""} maxLength={120} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Costo de la esquila" ayuda="Opcional. Lo que pagaste en total.">
          {(id) => <input id={id} name="costo" inputMode="decimal" defaultValue={esquila.costo ?? ""} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Notas" ayuda="Opcional.">
          {(id) => <input id={id} name="notas" defaultValue={esquila.notas ?? ""} maxLength={1000} autoComplete="off" enterKeyHint="done" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <section className="space-y-3" aria-label="Ovejas esquiladas">
        <h2 className="border-b border-arena pb-1.5 font-display text-lg font-semibold">Ovejas esquiladas</h2>
        <p className="text-[0.8125rem] text-humo">Las ovejas de esta esquila no se pueden cambiar: si te equivocaste de ovejas, anula la esquila y registra otra. Aquí puedes corregir los kilos de cada una.</p>
        <ListaEscalable<OvejaDeEsquila>
          cargar={cargar}
          clave={(o) => o.id}
          vacio={<p className="px-2 py-6 text-center text-[0.9375rem] text-humo">Esta esquila no tiene ovejas.</p>}
          fila={(o) => (
            <div className="min-w-0 space-y-2 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <p className="font-semibold [overflow-wrap:anywhere]">{o.numero_arete}{o.nombre ? <span className="font-normal text-humo"> · {o.nombre}</span> : null}</p>
              <input
                aria-label={`Kilos de vellón de ${o.numero_arete}`}
                inputMode="decimal"
                autoComplete="off"
                value={pesos[o.id] ?? ""}
                onChange={(e) => setPesos((p) => ({ ...p, [o.id]: e.target.value }))}
                placeholder="Kilos de vellón (opcional)"
                className={CLASE_INPUT}
              />
            </div>
          )}
        />
      </section>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          Guardar cambios
        </Boton>
        <Link href="/esquila" className={clasesBoton("secundario")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
