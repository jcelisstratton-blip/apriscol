export type Turno = "manana" | "tarde" | "noche";
export const TURNOS: Turno[] = ["manana", "tarde", "noche"];
export const ETIQUETA_TURNO: Record<Turno, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };

/** Los turnos en que se ordeña una hembra. Sin programar (`null`) cuenta como todos, que es como funcionaba antes de existir el programa. */
export function turnosDe(programados: string[] | null | undefined): Turno[] {
  if (programados === null || programados === undefined) return [...TURNOS];
  return TURNOS.filter((t) => programados.includes(t));
}

