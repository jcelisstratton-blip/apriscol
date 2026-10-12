"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { crearPesaje, editarPesaje } from "@/app/(app)/carne/actions";
import { ETIQUETA_PESAJE, TIPOS_PESAJE } from "@/lib/carne";
import { textoCC, VALORES_CC } from "@/lib/empadronamiento";
import type { Pesaje, TipoPesaje } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Registrar o corregir el peso de un animal (viene fijo desde su ficha). Un solo peso por animal y día. */
export function FormPeso({ animalId, hoy, pesaje, solicitud }: { animalId: string; hoy: string; pesaje?: Pesaje; solicitud?: string }) {
  const editando = Boolean(pesaje);
  const [estado, enviar, pendiente] = useActionState(editando ? editarPesaje : crearPesaje, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoPesaje>(pesaje?.tipo ?? "control");
  const [cc, setCc] = useState<number | "">(pesaje?.condicion_corporal ?? "");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      {pesaje ? <input type="hidden" name="pesaje_id" value={pesaje.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Peso (kg)">
        {(id) => <input id={id} name="peso_kg" defaultValue={coma(pesaje?.peso_kg)} inputMode="decimal" autoComplete="off" enterKeyHint="next" required placeholder="Ej. 23,5" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={pesaje?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Tipo de pesaje">
        {(id) => (
          <Selector id={id} nombre="tipo" valor={tipo} onCambio={(v) => v && setTipo(v)} titulo="¿Qué pesaje es?" opciones={TIPOS_PESAJE.map((t) => ({ valor: t, etiqueta: ETIQUETA_PESAJE[t] }))} />
        )}
      </Campo>

      <Campo etiqueta="Condición corporal" ayuda="Opcional. De 1 (muy flaca) a 5 (muy gorda). La temporada de monta la usa para elegir hembras.">
        {(id) => (
          <Selector id={id} nombre="condicion_corporal" valor={cc} onCambio={setCc} titulo="Condición corporal" placeholder="Sin anotar" permitirVacio opciones={VALORES_CC.map((v) => ({ valor: v, etiqueta: textoCC(v) }))} />
        )}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={pesaje?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar peso"}
        </Boton>
        <Link href={`/hato/${animalId}#crecimiento`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
