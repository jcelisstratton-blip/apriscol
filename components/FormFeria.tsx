"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { CamposFeria } from "@/components/CamposFeria";
import { crearFeria, editarFeria } from "@/app/(app)/ferias/actions";
import type { NivelFeria } from "@/lib/tipos";

export type FeriaEditable = {
  id: string;
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
};

/** Registrar una feria o corregir los datos de una ya registrada. */
export function FormFeria({ animalId, feria }: { animalId?: string; feria?: FeriaEditable }) {
  const editando = Boolean(feria);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFeria : crearFeria, undefined);
  const [, iniciar] = useTransition();

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {feria ? <input type="hidden" name="feria_id" value={feria.id} /> : null}
      {animalId ? <input type="hidden" name="animal" value={animalId} /> : null}
      <CamposFeria feria={feria} />

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando={editando ? "Guardando cambios…" : "Guardando feria…"}>
          {editando ? "Guardar cambios" : "Guardar feria"}
        </Boton>
        {feria ? (
          <Link href={`/ferias/${feria.id}`} className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
