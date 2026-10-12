export type Turno = "manana" | "tarde" | "noche";
export const TURNOS: Turno[] = ["manana", "tarde", "noche"];
export const ETIQUETA_TURNO: Record<Turno, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };

/** Los turnos en que se ordeña una hembra. Sin programar (`null`) cuenta como todos, que es como funcionaba antes de existir el programa. */
export function turnosDe(programados: string[] | null | undefined): Turno[] {
  if (programados === null || programados === undefined) return [...TURNOS];
  return TURNOS.filter((t) => programados.includes(t));
}

/** «Mañana y tarde», «Los tres turnos», «Ningún turno». */
export function textoTurnos(programados: string[] | null | undefined): string {
  const t = turnosDe(programados);
  if (t.length === 0) return "Ningún turno";
  if (t.length === TURNOS.length) return "Los tres turnos";
  const nombres = t.map((x) => ETIQUETA_TURNO[x].toLowerCase());
  return (nombres.length === 1 ? nombres[0] : `${nombres[0]} y ${nombres[1]}`).replace(/^./, (c) => c.toUpperCase());
}
