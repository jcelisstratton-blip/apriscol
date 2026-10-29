"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { crearConsumo, editarConsumo } from "@/app/(app)/carne/actions";
import type { ConsumoLote } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Registrar o corregir el alimento que comió un lote: con esto se calcula cuánto alimento cuesta cada kilo que ganan. */
export function FormConsumo({ loteId, hoy, consumo, solicitud, alimentos = [] }: { loteId: string; hoy: string; consumo?: ConsumoLote; solicitud?: string; alimentos?: { valor: string; etiqueta: string }[] }) {
  const editando = Boolean(consumo);
  const [estado, enviar, pendiente] = useActionState(editando ? editarConsumo : crearConsumo, undefined);
  const [, iniciar] = useTransition();
  const [producto, setProducto] = useState(consumo?.producto_id ?? "");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="lote_id" value={loteId} />
      {consumo ? <input type="hidden" name="consumo_id" value={consumo.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Alimento (kg)" ayuda="Los kilos que comió todo el lote.">
        {(id) => <input id={id} name="kg_alimento" defaultValue={coma(consumo?.kg_alimento)} inputMode="decimal" autoComplete="off" enterKeyHint="next" required placeholder="Ej. 45" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={consumo?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      {alimentos.length > 0 ? (
        <Campo etiqueta="Qué alimento" ayuda="Si lo eliges de la lista, se descuenta solo del inventario de alimento.">
          {(id) => <Selector id={id} nombre="producto_id" valor={producto} onCambio={(v) => setProducto(String(v))} titulo="¿Qué alimento?" placeholder="Otro alimento" permitirVacio opciones={alimentos} />}
        </Campo>
      ) : null}
      {producto ? null : (
        <Campo etiqueta={alimentos.length > 0 ? "Otro alimento" : "Qué alimento"} ayuda="Opcional. Concentrado, forraje, sal mineralizada…">
          {(id) => <input id={id} name="alimento" defaultValue={consumo?.producto_id ? "" : (consumo?.alimento ?? "")} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      )}

      <Campo etiqueta="Costo ($)" ayuda="Opcional.">
        {(id) => <input id={id} name="costo" defaultValue={coma(consumo?.costo)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 85.000" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={consumo?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar alimento"}
        </Boton>
        <Link href={`/carne/lotes/${loteId}#consumo`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
