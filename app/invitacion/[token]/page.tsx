import type { Metadata } from "next";
import { Aviso } from "@/components/Aviso";
import { EnlaceBoton } from "@/components/Boton";
import { FormAceptar } from "@/components/FormAceptar";
import { FormCambiarCuenta } from "@/components/FormCambiarCuenta";
import { PantallaAuth } from "@/components/PantallaAuth";
import { estadoInvitacion, type ResumenInvitacion } from "@/lib/invitacion";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { RolFinca } from "@/lib/tipos";

export const metadata: Metadata = { title: "Invitación" };

/**
 * Enlace de una invitación. Se puede abrir sin sesión: quien no tiene cuenta ve a qué lo invitaron y crea la suya con el correo invitado (sin esto, la
 * pantalla de entrada le pedía una contraseña que no existe). Con sesión del correo invitado ofrece aceptar; con la de otro correo, cambiar de cuenta.
 */
export default async function PaginaInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const correoSesion = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc("invitacion_publica", { p_token: token }) : { data: null };
  const resumen: ResumenInvitacion | null = (data ?? [])[0] ?? null;
  const rol = resumen ? (ETIQUETA_ROL[resumen.rol as RolFinca] ?? resumen.rol).toLowerCase() : "";

  if (!resumen) {
    return (
      <PantallaAuth titulo="Esta invitación no sirve" subtitulo="El enlace ya se usó, venció o no es correcto. Pídele a quien te invitó que te envíe uno nuevo.">
        <EnlaceBoton href="/">Ir al inicio</EnlaceBoton>
      </PantallaAuth>
    );
  }

  // Sin sesión: crear la cuenta con el correo invitado (lo más probable) o entrar si ya la tiene.
  if (!correoSesion) {
    const destino = encodeURIComponent(`/invitacion/${token}`);
    const correo = encodeURIComponent(resumen.email);
    return (
      <PantallaAuth titulo={`Te invitaron a ${resumen.finca_nombre}`} subtitulo={`Entrarás como ${rol} con el correo ${resumen.email}.`}>
        <div className="space-y-3">
          <Aviso tipo="info">Para aceptar necesitas una cuenta con ese mismo correo. Si es tu primera vez, créala: tarda un minuto.</Aviso>
          <EnlaceBoton href={`/registro?next=${destino}&email=${correo}`}>Crear mi cuenta</EnlaceBoton>
          <EnlaceBoton href={`/login?next=${destino}&email=${correo}`} variante="secundario">
            Ya tengo cuenta: entrar
          </EnlaceBoton>
        </div>
      </PantallaAuth>
    );
  }

  const estado = estadoInvitacion(resumen, correoSesion);
  if (estado.tipo === "otro_correo") {
    return (
      <PantallaAuth titulo="Esta invitación es para otro correo" subtitulo={`Te invitaron a ${resumen.finca_nombre} como ${rol} con el correo ${estado.invitado}.`}>
        <div className="space-y-4">
          <Aviso tipo="atencion">
            Ahora tienes abierta la sesión de {estado.sesion}. La invitación solo se puede aceptar con {estado.invitado}: cierra esta sesión y entra o crea tu cuenta con ese correo.
          </Aviso>
          <FormCambiarCuenta token={token} />
        </div>
      </PantallaAuth>
    );
  }

  return (
    <PantallaAuth titulo="Te invitaron a una finca" subtitulo={`Te invitaron a ${resumen.finca_nombre} como ${rol}. Vas a entrar con ${resumen.email}.`}>
      <FormAceptar token={token} />
    </PantallaAuth>
  );
}
