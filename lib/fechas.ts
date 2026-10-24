const ZONA = "America/Bogota";

/** Fecha de hoy en Colombia como YYYY-MM-DD (no la del servidor, que corre en UTC). */
export function hoyBogota(fecha = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function formatoFecha(iso: string | null, opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { ...opciones, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** «21 oct 2026, 2:38 p. m.» en la hora de Colombia, para un instante guardado como timestamptz. */
export function fechaHoraBogota(instante: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(instante));
}

export function edadTexto(nacimiento: string | null, hoy = hoyBogota()): string {
  if (!nacimiento) return "Edad sin registrar";
  const a = new Date(`${nacimiento}T12:00:00Z`);
  const b = new Date(`${hoy}T12:00:00Z`);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses -= 1;
  if (meses < 1) return "Menos de 1 mes";
  if (meses < 24) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const años = Math.floor(meses / 12);
  return `${años} años`;
}

export function diasHasta(iso: string, hoy = hoyBogota()): number {
  return Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000);
}

/** Días que pasaron desde una fecha hasta hoy (positivo si ya pasó, negativo si aún no llega). */
export function diasDesde(iso: string, hoy = hoyBogota()): number {
  // Al revés de `diasHasta` (y no «-diasHasta») para que el mismo día dé 0 y no -0, que se vería «-0».
  return diasHasta(hoy, iso);
}

export function litros(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n ?? 0);
}
