"use client";

import { useActionState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { repetirSalidas } from "@/app/(app)/inventario/alimento/actions";

/** Repetir en el día de hoy las raciones anotadas otro día: un solo toque. */
export function FormRepetirDia({ origen, cuantas, solicitud }: { origen: string; cuantas: number; solicitud: string }) {
  const [estado, enviar, pendiente] = useActionState(repetirSalidas, undefined);
  const [, iniciar] = useTransition();

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-3">
      <input type="hidden" name="origen" value={origen} />
      <input type="hidden" name="client_request_id" value={solicitud} />
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Anotando…">
        {cuantas === 1 ? "Repetir esta ración hoy" : `Repetir estas ${cuantas} raciones hoy`}
      </Boton>
    </form>
  );
}
