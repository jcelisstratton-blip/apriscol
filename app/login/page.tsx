import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { Presentacion } from "@/components/presentacion/Presentacion";
import { correoDeInvitacion } from "@/lib/invitacion";
import { destinoSeguro } from "@/lib/redireccion";
import { iniciarSesion } from "./actions";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Apriscol: hato, genealogía, leche, sanidad, partos, corrales, carne y costos de cabras y ovejas, desde el celular.",
};

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string }> }) {
  const { next, error, email } = await searchParams;
  const destino = next ? destinoSeguro(next) : undefined;
  return (
    <Presentacion
      modo="login"
      formulario={
        <FormAuth
          accion={iniciarSesion}
          modo="login"
          next={destino}
          emailInicial={correoDeInvitacion(destino, email)}
          errorInicial={error === "enlace" ? "El enlace del correo venció o ya se usó. Inicia sesión o pide uno nuevo." : undefined}
        />
      }
    />
  );
}
