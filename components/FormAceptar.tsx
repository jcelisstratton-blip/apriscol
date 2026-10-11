"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { aceptarInvitacion, type EstadoAceptar } from "@/app/invitacion/[token]/actions";

export function FormAceptar({ token }: { token: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoAceptar, FormData>(() => aceptarInvitacion(token), undefined);
  return (
    <form action={enviar} className="space-y-4">
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Uniéndote…">
        Aceptar y entrar
      </Boton>
    </form>
  );
}
