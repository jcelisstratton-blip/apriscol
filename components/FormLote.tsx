"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { crearLote, editarLote } from "@/app/(app)/carne/actions";
import type { LoteCeba } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Crear o corregir un lote de ceba: el grupo de animales que se engorda junto, con su peso meta para el beneficio. */
export function FormLote({ hoy, lote, solicitud }: { hoy: string; lote?: LoteCeba; solicitud?: string }) {
  const editando = Boolean(lote);
  const [estado, enviar, pendiente] = useActionState(editando ? editarLote : crearLote, undefined);
  const [, iniciar] = useTransition();

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {lote ? <input type="hidden" name="lote_id" value={lote.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Nombre del lote" ayuda="Por ejemplo «Machos octubre» o «Corral 2».">
        {(id) => <input id={id} name="nombre" defaultValue={lote?.nombre ?? ""} maxLength={80} required autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Empieza el" ayuda="Desde esta fecha se cuenta lo que ganan los animales y lo que comen.">
        {(id) => <input id={id} name="fecha_inicio" type="date" defaultValue={lote?.fecha_inicio ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Peso meta para el beneficio (kg)" ayuda="Opcional. Con este peso, el animal aparece como «listo para beneficio».">
        {(id) => <input id={id} name="peso_meta_kg" defaultValue={coma(lote?.peso_meta_kg)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 35" className={CLASE_INPUT} />}
      </Campo>

      {editando ? (
        <Campo etiqueta="Cerrado el" ayuda="Opcional. Pon la fecha cuando ya no se engorde más este lote; déjala vacía para mantenerlo abierto.">
          {(id) => <input id={id} name="cerrado_en" type="date" defaultValue={lote?.cerrado_en ?? ""} max={hoy} className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={lote?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Crear lote"}
        </Boton>
        <Link href={lote ? `/carne/lotes/${lote.id}` : "/carne?vista=lotes"} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
