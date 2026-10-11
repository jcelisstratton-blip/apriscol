import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { PantallaAuth } from "@/components/PantallaAuth";
import { destinoSeguro } from "@/lib/redireccion";
import { registrarse } from "@/app/login/actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function PaginaRegistro({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <PantallaAuth titulo="Crea tu cuenta" subtitulo="En un minuto tienes tu finca lista para registrar el primer animal.">
      <FormAuth accion={registrarse} modo="registro" next={next ? destinoSeguro(next) : undefined} />
    </PantallaAuth>
  );
}
