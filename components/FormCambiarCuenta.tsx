"use client";

import { Boton } from "@/components/Boton";
import { cerrarSesionYVolver } from "@/app/invitacion/[token]/actions";

/** Cierra la sesión y vuelve a esta misma invitación para entrar con el correo al que se envió. */
export function FormCambiarCuenta({ token }: { token: string }) {
  return (
    <form action={() => cerrarSesionYVolver(token)}>
      <Boton type="submit" variante="secundario">
        Cerrar sesión y entrar con otro correo
      </Boton>
    </form>
  );
}
