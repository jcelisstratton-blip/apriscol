import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { PantallaAuth } from "@/components/PantallaAuth";
import { destinoSeguro } from "@/lib/redireccion";
import { iniciarSesion } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <PantallaAuth titulo="Tu aprisco, al día" subtitulo="Ordeños, sanidad, partos y genealogía de cabras y ovejas, desde el celular.">
      <FormAuth
        accion={iniciarSesion}
        modo="login"
        next={next ? destinoSeguro(next) : undefined}
        errorInicial={error === "enlace" ? "El enlace del correo venció o ya se usó. Inicia sesión o pide uno nuevo." : undefined}
      />
    </PantallaAuth>
  );
}
