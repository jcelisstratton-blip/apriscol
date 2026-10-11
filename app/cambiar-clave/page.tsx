import type { Metadata } from "next";
import { FormClave } from "@/components/FormClave";
import { PantallaAuth } from "@/components/PantallaAuth";
import { obtenerUsuario } from "@/lib/contexto";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default async function PaginaCambiarClave() {
  const user = await obtenerUsuario();
  return (
    <PantallaAuth titulo="Elige tu contraseña nueva" subtitulo={`Para la cuenta ${user.email}. Después sigues entrando con ella.`}>
      <FormClave />
    </PantallaAuth>
  );
}
