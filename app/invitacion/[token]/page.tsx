import type { Metadata } from "next";
import { Aviso } from "@/components/Aviso";
import { EnlaceBoton } from "@/components/Boton";
import { FormAceptar } from "@/components/FormAceptar";
import { FormCambiarCuenta } from "@/components/FormCambiarCuenta";
import { PantallaAuth } from "@/components/PantallaAuth";
import { obtenerUsuario } from "@/lib/contexto";
import { estadoInvitacion, type ResumenInvitacion } from "@/lib/invitacion";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { RolFinca } from "@/lib/tipos";

export const metadata: Metadata = { title: "Invitación" };

export default async function PaginaInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc("invitacion_resumen", { p_token: token }) : { data: null };
  const resumen: ResumenInvitacion | null = (data ?? [])[0] ?? null;
  const estado = estadoInvitacion(resumen, user.email);
  const rol = resumen ? (ETIQUETA_ROL[resumen.rol as RolFinca] ?? resumen.rol).toLowerCase() : "";

  if (estado.tipo === "no_valida") {
    return (
      <PantallaAuth titulo="Esta invitación no sirve" subtitulo="El enlace ya se usó, venció o no es correcto. Pídele a quien te invitó que te envíe uno nuevo.">
        <EnlaceBoton href="/">Ir al inicio</EnlaceBoton>
      </PantallaAuth>
    );
  }

  if (estado.tipo === "otro_correo") {
    return (
      <PantallaAuth titulo="Esta invitación es para otro correo" subtitulo={`Te invitaron a ${resumen!.finca_nombre} como ${rol} con el correo ${estado.invitado}.`}>
        <div className="space-y-4">
          <Aviso tipo="atencion">
            Ahora tienes abierta la sesión de {estado.sesion}. La invitación solo se puede aceptar con {estado.invitado}: cierra esta sesión y entra con ese correo.
          </Aviso>
          <FormCambiarCuenta token={token} />
        </div>
      </PantallaAuth>
    );
  }

  return (
    <PantallaAuth titulo="Te invitaron a una finca" subtitulo={`Te invitaron a ${resumen!.finca_nombre} como ${rol}. Vas a entrar con ${estado.invitado}.`}>
      <FormAceptar token={token} />
    </PantallaAuth>
  );
}
