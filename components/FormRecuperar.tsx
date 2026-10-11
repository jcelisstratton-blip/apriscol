"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { pedirRecuperacion } from "@/app/login/actions";

export function FormRecuperar({ errorInicial }: { errorInicial?: string }) {
  const [estado, enviar, pendiente] = useActionState(pedirRecuperacion, undefined);
  const enviado = Boolean(estado?.aviso);

  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Correo de tu cuenta">
        {(id) => (
          <input
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            className={CLASE_INPUT}
            placeholder="tu@correo.com"
          />
        )}
      </Campo>

      {estado?.error ?? errorInicial ? <Aviso tipo="error">{estado?.error ?? errorInicial ?? ""}</Aviso> : null}
      {estado?.aviso ? (
        <div className="space-y-2">
          <Aviso tipo="exito">{estado.aviso}</Aviso>
          <p className="text-[0.8125rem] text-humo">Si no lo ves en unos minutos, revisa la carpeta de correo no deseado.</p>
        </div>
      ) : null}

      <Boton type="submit" pendiente={pendiente} cargando="Enviando…">
        {enviado ? "Enviar de nuevo" : "Enviar enlace"}
      </Boton>

      <p className="text-center">
        <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </form>
  );
}
