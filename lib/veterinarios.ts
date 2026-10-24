/** Los veterinarios de la finca (del equipo) que se ofrecen al registrar quién hizo un procedimiento. */
export type VeterinarioRef = { id: string; nombre: string; tarjeta_profesional: string | null };

export const OTRA_PERSONA = "otra";

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Qué se ve elegido al abrir el formulario. Si ya había un nombre, el del veterinario que coincide o «otra persona»; si es nuevo y la finca tiene un solo
 * veterinario, ese (es la opción inicial); con varios no se adivina; sin veterinarios solo se escribe el nombre.
 */
export function eleccionInicialResponsable(veterinarios: VeterinarioRef[], actual?: string | null): string {
  const nombre = actual?.trim();
  if (nombre) return veterinarios.find((v) => igual(v.nombre, nombre))?.id ?? OTRA_PERSONA;
  if (veterinarios.length === 1) return veterinarios[0].id;
  return veterinarios.length === 0 ? OTRA_PERSONA : "";
}

/** El nombre que se guarda en el registro: el del veterinario elegido o lo que se escribió. */
export function nombreResponsable(veterinarios: VeterinarioRef[], eleccion: string, escrito: string): string {
  if (eleccion === OTRA_PERSONA) return escrito.trim();
  return veterinarios.find((v) => v.id === eleccion)?.nombre ?? "";
}
