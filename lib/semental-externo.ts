import { diasHasta, hoyBogota } from "@/lib/fechas";
import type { SementalExterno } from "@/lib/tipos";

/** Lo que se escribe en el formulario de un semental de otro hato (todo texto; las fechas, AAAA-MM-DD). */
export type DatosExterno = {
  chip: string;
  nombre: string;
  hato: string;
  propietario: string;
  telefono: string;
  /** La raza (de `razas`): obligatoria y de la especie del semental. */
  razaId: number | "";
  nacimiento: string;
  desde: string;
  hasta: string;
  sanidad: string;
  condiciones: string;
};

export const PRESTAMO_MAX_DIAS = 400;

export const datosExternoVacios = (desde: string, hasta: string): DatosExterno => ({
  chip: "",
  nombre: "",
  hato: "",
  propietario: "",
  telefono: "",
  razaId: "",
  nacimiento: "",
  desde,
  hasta,
  sanidad: "",
  condiciones: "",
});

export const datosDesdeExterno = (e: SementalExterno): DatosExterno => ({
  chip: e.chip,
  nombre: e.nombre,
  hato: e.hato_origen,
  propietario: e.propietario ?? "",
  telefono: e.telefono ?? "",
  razaId: e.raza_id,
  nacimiento: e.fecha_nacimiento ?? "",
  desde: e.prestamo_desde,
  hasta: e.prestamo_hasta,
  sanidad: e.sanidad ?? "",
  condiciones: e.condiciones ?? "",
});

/** Cómo se nombra a un semental de otro hato en listas y mensajes. */
export const etiquetaExterno = (e: { nombre: string; chip: string }) => `${e.nombre} · ${e.chip}`;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Qué falta o está mal para poder guardar el semental (vacío si todo está bien). */
export function faltantesExterno(d: DatosExterno): string[] {
  const f: string[] = [];
  if (!d.chip.trim()) f.push("el chip");
  if (!d.nombre.trim()) f.push("el nombre del animal");
  if (d.razaId === "") f.push("la raza");
  if (!d.hato.trim()) f.push("el nombre del hato");
  if (!FECHA.test(d.desde)) f.push("cuándo llega");
  if (!FECHA.test(d.hasta)) f.push("cuándo se devuelve");
  if (FECHA.test(d.desde) && FECHA.test(d.hasta)) {
    const dias = diasHasta(d.hasta, d.desde);
    if (dias < 0) f.push("una devolución que no sea antes de la llegada");
    else if (dias > PRESTAMO_MAX_DIAS) f.push(`un préstamo de máximo ${PRESTAMO_MAX_DIAS} días`);
  }
  return f;
}

/** Días que dura el préstamo, contando el de llegada y el de devolución. */
export const diasPrestamo = (desde: string, hasta: string) => diasHasta(hasta, desde) + 1;

/** Si el préstamo ya terminó (`vencido`) o cuántos días faltan para la devolución. */
export function estadoPrestamo(hasta: string, hoy = hoyBogota()): { vencido: boolean; faltan: number } {
  const faltan = diasHasta(hasta, hoy);
  return { vencido: faltan < 0, faltan: Math.max(0, faltan) };
}
