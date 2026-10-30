/** Los parámetros de aviso por persona que fija el superadministrador (los mismos de `notificacion_preferencias`). */
export type ParametrosAvisos = {
  activo: boolean;
  resumen: boolean;
  resumen_hora: string;
  dias: number[];
  nivel_minimo: "rojo" | "ambar";
  alertas: boolean;
  semanal: boolean;
  silencio_desde: string;
  silencio_hasta: string;
  max_diarios: number;
};

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const MAX_DIARIOS = 30;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «06:30:00» (lo que devuelve la base) → «06:30» (lo que entiende un campo de hora). */
export const horaCorta = (hora: string): string => hora.slice(0, 5);

/** Revisa lo que llega del navegador y devuelve los datos listos para la función SQL, o la frase que explica qué está mal. */
export function validarParametros(e: ParametrosAvisos): { ok: true; datos: ParametrosAvisos } | { ok: false; error: string } {
  const horas: [string, string][] = [
    [e.resumen_hora, "La hora del resumen"],
    [e.silencio_desde, "El inicio del silencio"],
    [e.silencio_hasta, "El final del silencio"],
  ];
  for (const [valor, nombre] of horas) {
    if (typeof valor !== "string" || !HORA.test(valor)) return { ok: false, error: `${nombre} no es válida. Usa el formato 06:30.` };
  }
  if (!Array.isArray(e.dias) || e.dias.length === 0 || !e.dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    return { ok: false, error: "Elige al menos un día de la semana." };
  }
  if (e.nivel_minimo !== "rojo" && e.nivel_minimo !== "ambar") return { ok: false, error: "El nivel de aviso no es válido." };
  if (!Number.isInteger(e.max_diarios) || e.max_diarios < 1 || e.max_diarios > MAX_DIARIOS) {
    return { ok: false, error: `El máximo de mensajes al día va de 1 a ${MAX_DIARIOS}.` };
  }
  return { ok: true, datos: { ...e, dias: [...new Set(e.dias)].sort((a, b) => a - b), activo: !!e.activo, resumen: !!e.resumen, alertas: !!e.alertas, semanal: !!e.semanal } };
}
