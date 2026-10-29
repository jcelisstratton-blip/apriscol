"use client";

import { useActionState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { guardarPesoUnidad } from "@/app/(app)/inventario/alimento/actions";
import { singular } from "@/lib/inventario-alimento";

const coma = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Cuánto pesa cada bulto o paca de un alimento. Sin ese peso, lo que se compra en esa unidad no se puede pasar a kg ni sumar al inventario. */
export function FormPesoUnidad({ productoId, unidad, kg }: { productoId: string; unidad: string; kg: number | null }) {
  const [estado, enviar, pendiente] = useActionState(guardarPesoUnidad, undefined);
  const [, iniciar] = useTransition();
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <input type="hidden" name="producto_id" value={productoId} />
      <Campo etiqueta={`¿Cuántos kg pesa cada ${singular(unidad)}?`} ayuda="Está en la etiqueta del bulto o se pesa una vez.">
        {(id) => <input id={id} name="kg" defaultValue={coma(kg)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 40" />}
      </Campo>
      <Aviso tipo="info">Si cambias el peso, se recalculan las compras anteriores.</Aviso>
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
        Guardar peso
      </Boton>
    </form>
  );
}
