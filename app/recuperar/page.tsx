import type { Metadata } from "next";
import { FormRecuperar } from "@/components/FormRecuperar";
import { PantallaAuth } from "@/components/PantallaAuth";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function PaginaRecuperar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <PantallaAuth titulo="Recupera tu acceso" subtitulo="Escribe el correo con el que creaste la cuenta y te enviamos un enlace para elegir una contraseña nueva.">
      <FormRecuperar errorInicial={error === "enlace" ? "El enlace venció o ya se usó. Pide uno nuevo y ábrelo desde este mismo teléfono." : undefined} />
    </PantallaAuth>
  );
}
