/** Los veterinarios de la finca (del equipo) que se ofrecen al registrar quién asistió un procedimiento. */
export type VeterinarioRef = { id: string; nombre: string; tarjeta_profesional: string | null };

/** Quién asistió: el veterinario de la finca o otra persona. Son excluyentes. */
export type QuienAsistio = "veterinario" | "otra" | "";

export type EstadoAsistencia = { quien: QuienAsistio; veterinarioId: string; escrito: string };

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Qué se ve elegido al abrir el formulario. Con un nombre ya guardado: el veterinario que coincide, o «otra persona» con ese nombre. Si es nuevo y la finca
 * tiene veterinarios, «Veterinario» (con uno solo, ya elegido; con varios se elige); sin veterinarios no se adivina nada.
 */
export function estadoInicialAsistencia(veterinarios: VeterinarioRef[], actual?: string | null): EstadoAsistencia {
  const nombre = actual?.trim();
  if (nombre) {
    const vet = veterinarios.find((v) => igual(v.nombre, nombre));
    return vet ? { quien: "veterinario", veterinarioId: vet.id, escrito: "" } : { quien: "otra", veterinarioId: "", escrito: nombre };
  }
  if (veterinarios.length > 0) return { quien: "veterinario", veterinarioId: veterinarios.length === 1 ? veterinarios[0].id : "", escrito: "" };
  return { quien: "", veterinarioId: "", escrito: "" };
}

/** El nombre que se guarda en el registro: el del veterinario elegido o lo que se escribió (nunca los dos). */
export function nombreAsistencia(veterinarios: VeterinarioRef[], e: EstadoAsistencia): string {
  if (e.quien === "veterinario") return veterinarios.find((v) => v.id === e.veterinarioId)?.nombre ?? "";
  if (e.quien === "otra") return e.escrito.trim();
  return "";
}
