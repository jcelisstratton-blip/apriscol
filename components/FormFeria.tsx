"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { CamposFeria } from "@/components/CamposFeria";
import { editarFeria } from "@/app/(app)/ferias/actions";
import type { NivelFeria } from "@/lib/tipos";

export type FeriaEditable = {
  id: string;
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
};

/** Corregir los datos de una feria. Las ferias nacen al registrar un premio desde la ficha de un animal. */
export function FormFeria({ feria }: { feria: FeriaEditable }) {
  const [estado, enviar, pendiente] = useActionState(editarFeria, undefined);
  const [, iniciar] = useTransition();

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="feria_id" value={feria.id} />
      <CamposFeria feria={feria} />

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando cambios…">
          Guardar cambios
        </Boton>
        <Link href={`/ferias/${feria.id}`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
