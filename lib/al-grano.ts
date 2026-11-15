/**
 * El aviso de primera vez de «Al grano»: ayuda a que quien llega nuevo encuentre el botón del rayo. Solo lo ve durante el primer mes de su cuenta (cuenta de la
 * persona, no de la finca: quien entra por invitación a una finca antigua también es nueva), y desaparece solo cuando abre «Al grano» una vez o toca «Entendido».
 * Se recuerda en este navegador. «Probarlo ahora» abre la hoja de verdad: la barra de abajo (celular) o el menú lateral (computador), el que esté a la vista.
 */
export const DIAS_AVISO_AL_GRANO = 30;
export const CLAVE_AL_GRANO_VISTO = "apriscol:al-grano-visto";
export const EVENTO_AL_GRANO_VISTO = "apriscol:al-grano-visto";
export const EVENTO_ABRIR_AL_GRANO = "apriscol:abrir-al-grano";
/** Desde este ancho (1024 px, `lg`) se ve el menú lateral y no la barra de abajo. */
export const ANCHO_ESCRITORIO = 1024;

export const avisoAlGranoVisible = (diasDePersona: number): boolean => diasDePersona <= DIAS_AVISO_AL_GRANO;

/** La persona ya conoce «Al grano» (lo abrió o tocó «Entendido»): el aviso no vuelve en este navegador. Sin almacenamiento, vuelve en la próxima visita. */
export function marcarAlGranoVisto(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLAVE_AL_GRANO_VISTO, "1");
    window.dispatchEvent(new Event(EVENTO_AL_GRANO_VISTO));
  } catch {
    /* sin almacenamiento */
  }
}

/** Abre la hoja desde fuera de la barra: avisa si se está viendo el computador, para que la abra solo el menú que corresponde y no los dos. */
export function abrirAlGrano(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_AL_GRANO, { detail: { escritorio: window.matchMedia(`(min-width: ${ANCHO_ESCRITORIO}px)`).matches } }));
}
