/**
 * Trazabilidad de una cría: de dónde viene, dónde estuvo y qué le pasó. Todo se arma a partir de lo que ya se registra (parto, movimientos entre corrales,
 * pesajes, sanidad y baja); nada se guarda aparte. Una cría **sin arete** todavía no es un animal y no tiene movimientos propios: se asume que está donde
 * está su madre, y la pantalla lo dice.
 */
import type { MovimientoAnimal } from "@/lib/tipos";

export type Estancia = Pick<MovimientoAnimal, "ubicacion_id" | "desde" | "hasta">;

/**
 * En qué instalación estaba en una fecha. Un movimiento cubre desde su fecha de entrada hasta antes de su fecha de salida (la salida es la entrada del
 * siguiente). Devuelve null si en esa fecha no tenía ninguna.
 */
export function estanciaEn(movimientos: Estancia[], fecha: string): Estancia | null {
  const dia = [...movimientos]
    .sort((a, b) => b.desde.localeCompare(a.desde))
    .find((m) => m.desde <= fecha && (m.hasta === null || fecha < m.hasta || m.hasta === m.desde));
  return dia ?? null;
}

export type TipoHito = "nacimiento" | "ubicacion" | "peso" | "sanidad" | "arete" | "baja";

export type Hito = { clave: string; fecha: string; tipo: TipoHito; titulo: string; detalle?: string; href?: string };

/** Los hitos de la vida de una cría, del más antiguo al más reciente (a igual fecha, el nacimiento va primero). */
export function ordenarHitos(hitos: Hito[]): Hito[] {
  const peso: Record<TipoHito, number> = { nacimiento: 0, arete: 1, ubicacion: 2, peso: 3, sanidad: 4, baja: 5 };
  return [...hitos].sort((a, b) => a.fecha.localeCompare(b.fecha) || peso[a.tipo] - peso[b.tipo] || a.clave.localeCompare(b.clave));
}

/** Días completos entre dos fechas AAAA-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** «3 días», «1 día», «2 meses»: la edad que tenía en una fecha. */
export function textoEdad(nacimiento: string, fecha: string): string {
  const d = diasEntre(nacimiento, fecha);
  if (d < 0) return "aún no había nacido";
  if (d < 60) return `${d} ${d === 1 ? "día" : "días"}`;
  const m = Math.floor(d / 30.4375);
  return `${m} ${m === 1 ? "mes" : "meses"}`;
}
