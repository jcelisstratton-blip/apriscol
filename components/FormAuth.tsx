"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoClave } from "@/components/CampoClave";
import type { EstadoAuth } from "@/app/login/actions";

export function FormAuth({
  accion,
  modo,
  next,
  referido,
  errorInicial,
  emailInicial,
}: {
  accion: (estado: EstadoAuth, form: FormData) => Promise<EstadoAuth>;
  modo: "login" | "registro";
  next?: string;
  /** Código de quien invitó con su enlace de referidos (solo en el registro). */
  referido?: string;
  errorInicial?: string;
  /** Correo al que va dirigida la invitación con la que se llegó: queda escrito y no se puede cambiar. */
  emailInicial?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const esRegistro = modo === "registro";
  const sufijo = next ? `?next=${encodeURIComponent(next)}${emailInicial ? `&email=${encodeURIComponent(emailInicial)}` : ""}` : "";

  return (
    <form action={enviar} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {esRegistro && referido ? <input type="hidden" name="ref" value={referido} /> : null}
      {esRegistro ? (
        <Campo etiqueta="Tu nombre">
          {(id) => (
            <input id={id} name="nombre" autoComplete="name" required minLength={2} className={CLASE_INPUT} placeholder="Como te dicen en la finca" />
          )}
        </Campo>
      ) : null}
      <Campo etiqueta="Correo" ayuda={emailInicial ? "La invitación es para este correo." : undefined}>
        {(id) => (
          <input
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            defaultValue={emailInicial}
            readOnly={Boolean(emailInicial)}
            className={`${CLASE_INPUT}${emailInicial ? " bg-arena/50" : ""}`}
            placeholder="tu@correo.com"
          />
        )}
      </Campo>
      <Campo etiqueta="Contraseña" ayuda={esRegistro ? "Mínimo 8 caracteres." : undefined}>
        {(id) => (
          <CampoClave id={id} name="password" autoComplete={esRegistro ? "new-password" : "current-password"} minLength={esRegistro ? 8 : 1} />
        )}
      </Campo>
      {!esRegistro ? (
        <div className="-mt-2 flex justify-end">
          <Link href="/recuperar" className="inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      ) : null}

      {estado?.error ?? errorInicial ? <Aviso tipo="error">{estado?.error ?? errorInicial ?? ""}</Aviso> : null}
      {estado?.aviso ? <Aviso tipo="exito">{estado.aviso}</Aviso> : null}

      <Boton type="submit" pendiente={pendiente} cargando={esRegistro ? "Creando cuenta…" : "Entrando…"}>
        {esRegistro ? "Crear cuenta" : "Entrar"}
      </Boton>

      {esRegistro ? (
        <p className="-mt-1 text-center text-sm text-humo">
          Al crear tu cuenta aceptas los{" "}
          <Link href="/terminos" className="font-semibold text-musgo underline underline-offset-4">
            Términos de servicio
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="font-semibold text-musgo underline underline-offset-4">
            Política de privacidad
          </Link>
          .
        </p>
      ) : null}

      <p className="text-center text-[0.9375rem] text-humo">
        {esRegistro ? "¿Ya tienes cuenta? " : "¿Primera vez? "}
        <Link href={`${esRegistro ? "/login" : "/registro"}${sufijo}`} className="-mx-1 inline-flex min-h-11 items-center px-1 font-semibold text-musgo underline-offset-4 hover:underline">
          {esRegistro ? "Entra" : "Crea tu cuenta"}
        </Link>
      </p>
    </form>
  );
}
