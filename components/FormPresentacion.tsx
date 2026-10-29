"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { guardarPresentacion } from "@/app/(app)/inventario/actions";
import { enPresentaciones, plural } from "@/lib/inventario";

const coma = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Cómo viene el producto (frasco de 100 ml) y desde cuánto se avisa que queda poco. Sin la presentación, las compras no se pueden sumar al inventario. */
export function FormPresentacion({ productoId, unidad, presentacion, contenido, minimo }: { productoId: string; unidad: string | null; presentacion: string | null; contenido: number | null; minimo: number | null }) {
  const [estado, enviar, pendiente] = useActionState(guardarPresentacion, undefined);
  const [, iniciar] = useTransition();
  const [nombre, setNombre] = useState(presentacion ?? "");
  const u = unidad ?? "unidades";
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const minimoMostrado = minimo === null ? null : Math.round((enPresentaciones(minimo, contenido) ?? minimo) * 100) / 100;
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <input type="hidden" name="producto_id" value={productoId} />
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <Campo etiqueta="¿Cómo viene?" ayuda="Frasco, caja, sobre, bulto…">
          {(id) => <input id={id} name="presentacion" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. frasco" />}
        </Campo>
        <Campo etiqueta={`¿Cuántos ${u} trae cada uno?`}>
          {(id) => <input id={id} name="contenido" defaultValue={coma(contenido)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 100" />}
        </Campo>
      </div>
      <Campo etiqueta={`Avisar cuando queden ${nombre.trim() ? plural(nombre.trim(), 2) : u} o menos`} ayuda="Opcional. Se escribe en lo mismo que cuentas: si pusiste una presentación, en esas.">
        {(id) => <input id={id} name="minimo" defaultValue={coma(minimoMostrado)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 2" />}
      </Campo>
      <Aviso tipo="info">Si cambias cuánto trae cada presentación, se recalculan las compras anteriores.</Aviso>
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
        Guardar presentación
      </Boton>
    </form>
  );
}
