/** Lo que se sabe de una invitación pendiente (`invitacion_resumen`): a qué correo va dirigida, con qué rol y a qué finca. */
export type ResumenInvitacion = { email: string; rol: string; finca_nombre: string };

/**
 * Qué mostrar al abrir el enlace de una invitación. La invitación solo sirve para el correo al que se envió, así que si la persona tiene abierta
 * la sesión de otro correo (por ejemplo, la del propietario que la creó) no se le ofrece «Aceptar»: se le explica y se le deja cambiar de cuenta.
 */
export type EstadoInvitacion =
  | { tipo: "no_valida" }
  | { tipo: "otro_correo"; invitado: string; sesion: string }
  | { tipo: "lista"; invitado: string };

const limpio = (correo: string) => correo.trim().toLowerCase();

export function estadoInvitacion(resumen: ResumenInvitacion | null, correoSesion: string): EstadoInvitacion {
  if (!resumen) return { tipo: "no_valida" };
  if (limpio(resumen.email) !== limpio(correoSesion)) return { tipo: "otro_correo", invitado: resumen.email, sesion: correoSesion };
  return { tipo: "lista", invitado: resumen.email };
}
