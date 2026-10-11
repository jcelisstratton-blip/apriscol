"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { CampoClave } from "@/components/CampoClave";
import { cambiarClave } from "@/app/login/actions";

export function FormClave() {
  const [estado, enviar, pendiente] = useActionState(cambiarClave, undefined);
  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Contraseña nueva" ayuda="Mínimo 8 caracteres.">
        {(id) => <CampoClave id={id} name="password" autoComplete="new-password" minLength={8} />}
      </Campo>
      <Campo etiqueta="Repite la contraseña">
        {(id) => <CampoClave id={id} name="confirmar" autoComplete="new-password" minLength={8} />}
      </Campo>
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
        Guardar contraseña
      </Boton>
    </form>
  );
}
