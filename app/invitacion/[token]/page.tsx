import type { Metadata } from "next";
import { PantallaAuth } from "@/components/PantallaAuth";
import { FormAceptar } from "@/components/FormAceptar";
import { obtenerUsuario } from "@/lib/contexto";

export const metadata: Metadata = { title: "Invitación" };

export default async function PaginaInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await obtenerUsuario();
  return (
    <PantallaAuth titulo="Te invitaron a una finca" subtitulo={`Vas a entrar con ${user.email}. La invitación solo sirve para ese correo.`}>
      <FormAceptar token={token} />
    </PantallaAuth>
  );
}
