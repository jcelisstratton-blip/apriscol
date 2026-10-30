/** El enlace que abre el bot con el código ya puesto: Telegram lo manda como «/start CODIGO». */
export const enlaceBot = (bot: string, codigo: string): string => `https://t.me/${bot}?start=${encodeURIComponent(codigo)}`;

/** Cuánto vale un código de vinculación (minutos): el mismo plazo que pone la base de datos. */
export const MINUTOS_CODIGO = 15;

export type EstadoVinculo = "pendiente" | "activo" | "pausado" | "bloqueado";

export const ETIQUETA_VINCULO: Record<EstadoVinculo, string> = { pendiente: "Sin conectar", activo: "Conectado", pausado: "Pausado", bloqueado: "Bot bloqueado" };

const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** «06:30:00» → «6:30 a. m.» */
export function horaLegible(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export type PreferenciasAvisos = { activo: boolean; resumen: boolean; resumen_hora: string; dias: number[]; nivel_minimo: string };

/** Lo que va a recibir la persona, en una frase; `null` si el equipo de Apriscol todavía no le activó los avisos. */
export function describirAvisos(p: PreferenciasAvisos | null): string | null {
  if (!p || !p.activo || !p.resumen) return null;
  const dias = [...new Set(p.dias)].sort((a, b) => a - b);
  const cuando =
    dias.length === 7 ? "todos los días" : dias.join() === "1,2,3,4,5" ? "de lunes a viernes" : dias.map((d) => DIAS_CORTOS[d - 1]).join(", ");
  const que = p.nivel_minimo === "rojo" ? "solo lo urgente (rojo)" : "lo urgente (rojo) y lo que se programa (ámbar)";
  return `Resumen ${cuando} a las ${horaLegible(p.resumen_hora)}, con ${que}.`;
}
