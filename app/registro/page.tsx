import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { Presentacion } from "@/components/presentacion/Presentacion";
import { correoDeInvitacion } from "@/lib/invitacion";
import { destinoSeguro } from "@/lib/redireccion";
import { codigoValido } from "@/lib/referidos";
import { registrarse } from "@/app/login/actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function PaginaRegistro({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string; email?: string }> }) {
  const { next, ref, email } = await searchParams;
  const destino = next ? destinoSeguro(next) : undefined;
  return (
    <Presentacion modo="registro" formulario={<FormAuth accion={registrarse} modo="registro" next={destino} referido={codigoValido(ref)} emailInicial={correoDeInvitacion(destino, email)} />} />
  );
}
