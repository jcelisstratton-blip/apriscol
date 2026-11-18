import type { Metadata } from "next";
import { FormAuth } from "@/components/FormAuth";
import { Presentacion } from "@/components/presentacion/Presentacion";
import { correoDeInvitacion } from "@/lib/invitacion";
import { pesosPorDolar } from "@/lib/pago-manual";
import { destinoSeguro } from "@/lib/redireccion";
import { codigoValido } from "@/lib/referidos";
import { registrarse } from "@/app/login/actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function PaginaRegistro({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string; email?: string }> }) {
  const { next, ref, email } = await searchParams;
  const destino = next ? destinoSeguro(next) : undefined;
  const cambio = await pesosPorDolar();
  return (
    <Presentacion modo="registro" cambio={cambio} formulario={<FormAuth accion={registrarse} modo="registro" next={destino} referido={codigoValido(ref)} emailInicial={correoDeInvitacion(destino, email)} />} />
  );
}
