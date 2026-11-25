"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoClave } from "@/components/CampoClave";
import type { EstadoAuth } from "@/app/login/actions";
import { SIN_SENAL_ENTRAR } from "@/lib/campo";
import { esFallaDeRed } from "@/lib/offline/campo-envio";

/**
 * Entrar o crear la cuenta. Se envía con `onSubmit` (no con `action`): si la contraseña está mal o se cae la señal, lo escrito no se borra. Sin señal
 * no se puede entrar: lo dice en palabras de persona en vez de romper la pantalla (en la de entrada, `SinSenalAcceso` ofrece registrar sin señal).
 * Movimiento (`form-acceso`, `boton-acceso`, `enlace-suave` y `anim-aviso` en `globals.css`): detalles sutiles al pasar el mouse y al enfocar. El
 * aviso se esconde mientras se vuelve a intentar, para que reaparezca con su empujón corto si el intento también falla.
 */
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
  const [estado, enviar, pendiente] = useActionState(async (previo: EstadoAuth, datos: FormData): Promise<EstadoAuth> => {
    try {
      return await accion(previo, datos);
    } catch (e) {
      if (esFallaDeRed(e)) return { error: SIN_SENAL_ENTRAR };
      throw e;
    }
  }, undefined);
  const [, iniciar] = useTransition();
  const esRegistro = modo === "registro";
  const sufijo = next ? `?next=${encodeURIComponent(next)}${emailInicial ? `&email=${encodeURIComponent(emailInicial)}` : ""}` : "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        iniciar(() => enviar(datos));
      }}
      className="form-acceso space-y-4"
    >
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
          <Link href="/recuperar" className="inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold text-musgo enlace-suave">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      ) : null}

      {!pendiente && (estado?.error ?? errorInicial) ? <Aviso tipo="error" className="anim-aviso">{estado?.error ?? errorInicial ?? ""}</Aviso> : null}
      {!pendiente && estado?.aviso ? <Aviso tipo="exito" className="anim-aviso">{estado.aviso}</Aviso> : null}

      <Boton type="submit" pendiente={pendiente} cargando={esRegistro ? "Creando cuenta…" : "Entrando…"} className="boton-acceso">
        {esRegistro ? "Crear cuenta" : "Entrar"} <ArrowRight className="flecha size-[1.125rem]" strokeWidth={2.2} aria-hidden="true" />
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
        <Link href={`${esRegistro ? "/login" : "/registro"}${sufijo}`} className="-mx-1 inline-flex min-h-11 items-center px-1 font-semibold text-musgo enlace-suave">
          {esRegistro ? "Entra" : "Crea tu cuenta"}
        </Link>
      </p>
    </form>
  );
}
