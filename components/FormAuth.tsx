"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import type { EstadoAuth } from "@/app/login/actions";

export function FormAuth({
  accion,
  modo,
  next,
  errorInicial,
}: {
  accion: (estado: EstadoAuth, form: FormData) => Promise<EstadoAuth>;
  modo: "login" | "registro";
  next?: string;
  errorInicial?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const esRegistro = modo === "registro";
  const sufijo = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={enviar} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {esRegistro ? (
        <Campo etiqueta="Tu nombre">
          {(id) => (
            <input id={id} name="nombre" autoComplete="name" required minLength={2} className={CLASE_INPUT} placeholder="Como te dicen en la finca" />
          )}
        </Campo>
      ) : null}
      <Campo etiqueta="Correo">
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
      <Campo etiqueta="Contraseña" ayuda={esRegistro ? "Mínimo 8 caracteres." : undefined}>
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            autoComplete={esRegistro ? "new-password" : "current-password"}
            required
            minLength={esRegistro ? 8 : 1}
            className={CLASE_INPUT}
          />
        )}
      </Campo>

      {estado?.error ?? errorInicial ? <Aviso tipo="error">{estado?.error ?? errorInicial ?? ""}</Aviso> : null}
      {estado?.aviso ? <Aviso tipo="exito">{estado.aviso}</Aviso> : null}

      <Boton type="submit" pendiente={pendiente} cargando={esRegistro ? "Creando cuenta…" : "Entrando…"}>
        {esRegistro ? "Crear cuenta" : "Entrar"}
      </Boton>

      <p className="text-center text-[0.9375rem] text-humo">
        {esRegistro ? "¿Ya tienes cuenta? " : "¿Primera vez? "}
        <Link href={`${esRegistro ? "/login" : "/registro"}${sufijo}`} className="-mx-1 inline-flex min-h-11 items-center px-1 font-semibold text-musgo underline-offset-4 hover:underline">
          {esRegistro ? "Entra" : "Crea tu cuenta"}
        </Link>
      </p>
    </form>
  );
}
