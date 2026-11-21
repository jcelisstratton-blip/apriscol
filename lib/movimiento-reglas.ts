import { z } from "zod";
import { MOTIVOS } from "@/lib/corrales";
import { opcional } from "@/lib/validacion";
import type { MotivoMovimiento, TipoUbicacion, UsoUbicacion } from "@/lib/tipos";

/**
 * Mover animales (o sacarlos de su ubicación): la validación que comparten el formulario con señal (`moverAnimales`) y el envío sin señal
 * (`guardarMovimientoCampo`). La base (`mover_animales`) vuelve a exigir el cupo, la fecha y que los animales sigan activos.
 */
export const MAX_ANIMALES_MOVER = 1000;
const ID_UUID = z.uuid();

export const esquemaMover = z.object({
  destino: opcional(z.uuid("El destino no es válido.")),
  sin_destino: z.preprocess((v) => v === "si", z.boolean()),
  fecha: z.iso.date("Indica la fecha del movimiento."),
  motivo: z.enum(MOTIVOS as [string, ...string[]], "Elige el motivo."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  animal: opcional(z.uuid()),
  /** El destino al que se vuelve al terminar (la instalación desde la que se llegó). */
  volver: opcional(z.uuid()),
});

export type MovimientoLeido = { d: z.output<typeof esquemaMover>; ids: string[] };

/** Lee y valida un movimiento: los campos del formulario y los animales elegidos. `hoy` es el día de Colombia. */
export function leerMovimiento(campos: Record<string, unknown>, animales: readonly string[], hoy: string): MovimientoLeido | { error: string } {
  const datos = esquemaMover.safeParse(campos);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const ids = [...new Set(animales)];
  if (ids.length === 0) return { error: "Elige al menos un animal." };
  if (ids.length > MAX_ANIMALES_MOVER) return { error: `Son demasiados animales a la vez (máximo ${MAX_ANIMALES_MOVER}).` };
  if (!ids.every((i) => ID_UUID.safeParse(i).success)) return { error: "Hay un animal que no es válido. Elígelos de nuevo." };
  if (d.fecha > hoy) return { error: "La fecha no puede ser futura: registra lo que ya se movió." };
  if (!d.sin_destino && !d.destino) return { error: "Elige a dónde van los animales." };
  return { d, ids };
}

/** El motivo más probable según el destino (se puede cambiar). */
export function motivoPorDestino(u: { tipo: TipoUbicacion; uso: UsoUbicacion } | undefined): MotivoMovimiento | null {
  if (!u) return null;
  if (u.uso === "cuarentena") return "cuarentena";
  if (u.uso === "maternidad") return "maternidad";
  return u.tipo === "potrero" ? "rotacion" : "traslado";
}

/** Cuántos más caben en una instalación (null = sin tope) y cuántos de los elegidos entran de verdad (los que ya están ahí no se mueven). */
export function cupoDestino(capacidad: number | null, ocupantes: number, elegidos: number, yaAhi: number): { libres: number | null; entran: number; sinCupo: boolean } {
  const entran = Math.max(0, elegidos - yaAhi);
  const libres = capacidad ? Math.max(0, capacidad - ocupantes) : null;
  return { libres, entran, sinCupo: libres !== null && entran > libres };
}

/** El aviso de hacinamiento, igual con y sin señal. */
export function textoSinCupo(nombre: string, capacidad: number, ocupantes: number, libres: number, entran: number): string {
  return libres === 0
    ? `${nombre} está llena: caben ${capacidad} animales y ya tiene ${ocupantes}. Elige otra instalación o saca a algunos antes.`
    : `En ${nombre} solo caben ${libres} ${libres === 1 ? "animal más" : "animales más"} y elegiste ${entran}. Quita ${entran - libres} o elige otra instalación: el hacinamiento causa estrés, peleas y enfermedades respiratorias.`;
}
