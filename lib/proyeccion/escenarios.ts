import { limpiarAjustes, type Ajustes } from "@/lib/proyeccion/supuestos";

/** Un escenario guardado: un nombre, el horizonte y solo los números que la persona cambió. */
export type EscenarioGuardado = { id: string; nombre: string; horizonte: number; ajustes: Ajustes };

/** Cuántos escenarios puede guardar una finca. */
export const MAX_ESCENARIOS = 10;
export const NOMBRE_ESCENARIO_BASE = "Mi proyección";

/** El nombre sin espacios sobrantes; nulo si queda vacío o pasa de 80 letras. */
export function limpiarNombre(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const n = texto.replace(/\s+/g, " ").trim();
  return n.length >= 1 && n.length <= 80 ? n : null;
}

/** Un nombre que no choque con los que ya hay (sin importar mayúsculas): «Con más cabras», «Con más cabras 2»… */
export function nombreLibre(deseado: string, existentes: string[]): string {
  const usados = new Set(existentes.map((n) => n.trim().toLowerCase()));
  if (!usados.has(deseado.trim().toLowerCase())) return deseado;
  for (let i = 2; i < 100; i++) {
    const candidato = `${deseado} ${i}`;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
  return `${deseado} ${Date.now()}`;
}

/** Lo que llega de la base, ya limpio. */
export const aEscenario = (f: { id: string; nombre: string; horizonte_meses: number; ajustes: unknown }): EscenarioGuardado => ({ id: f.id, nombre: f.nombre, horizonte: f.horizonte_meses, ajustes: limpiarAjustes(f.ajustes) });
