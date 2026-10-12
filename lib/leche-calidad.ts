import type { DestinoLeche, MomentoFrio, TipoMantenimiento } from "@/lib/tipos";

export type Tono = "ok" | "aviso" | "alerta" | "neutro";

// ───────────────────────── Cadena de frío ─────────────────────────
/** Temperatura de conservación de la leche cruda: lo ideal es de 4 a 6 °C. */
export const FRIO_MIN = 4;
export const FRIO_MAX = 6;

export const MOMENTOS_FRIO: MomentoFrio[] = ["tras_ordeno", "almacenada", "despacho"];
export const ETIQUETA_MOMENTO_FRIO: Record<MomentoFrio, string> = {
  tras_ordeno: "Después del ordeño",
  almacenada: "Almacenada",
  despacho: "Al despachar",
};

export type EstadoValor = { tono: Tono; texto: string };

/** 4–6 °C está bien; hasta 2 °C de diferencia es de cuidado; más lejos, la leche está en riesgo. */
export function estadoTemperatura(c: number): EstadoValor {
  if (c >= FRIO_MIN && c <= FRIO_MAX) return { tono: "ok", texto: "En rango" };
  const lejos = c > FRIO_MAX ? c - FRIO_MAX : FRIO_MIN - c;
  if (lejos <= 2) return { tono: "aviso", texto: c > FRIO_MAX ? "Algo caliente" : "Muy fría" };
  return { tono: "alerta", texto: c > FRIO_MAX ? "Demasiado caliente" : "Demasiado fría" };
}

// ───────────────────────── Recuento de células somáticas ─────────────────────────
/**
 * Referencias orientativas para leche de cabra y oveja (miles de células por mililitro). No son una norma: cada comprador puede exigir
 * otro límite y las cabras suelen dar más que las vacas sin estar enfermas.
 */
export const RCS_BUENO = 1000;
export const RCS_ALTO = 1500;

export function estadoRcs(miles: number): EstadoValor {
  if (miles <= RCS_BUENO) return { tono: "ok", texto: "Bajo" };
  if (miles <= RCS_ALTO) return { tono: "aviso", texto: "Elevado" };
  return { tono: "alerta", texto: "Alto" };
}

export const formatoMiles = (miles: number) => `${miles.toLocaleString("es-CO")} mil/ml`;

// ───────────────────────── Despachos ─────────────────────────
export const DESTINOS_LECHE: DestinoLeche[] = ["industria", "queseria", "venta_directa", "otro"];
export const ETIQUETA_DESTINO: Record<DestinoLeche, string> = {
  industria: "Planta industrial",
  queseria: "Quesería artesanal",
  venta_directa: "Venta directa",
  otro: "Otro",
};

export const pesos = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// ───────────────────────── Equipo de ordeño ─────────────────────────
export const TIPOS_MANTENIMIENTO: TipoMantenimiento[] = ["lavado_alcalino", "lavado_acido", "presion_vacio", "pulsadores", "revision", "otro"];
export const ETIQUETA_MANTENIMIENTO: Record<TipoMantenimiento, string> = {
  lavado_alcalino: "Lavado alcalino",
  lavado_acido: "Lavado ácido",
  presion_vacio: "Presión de vacío",
  pulsadores: "Pulsadores",
  revision: "Revisión general",
  otro: "Otro",
};

export type PendienteEquipo<T> = { registro: T; dias: number };

/**
 * Qué tareas del equipo ya tocan o están por tocar. Para cada tarea (tipo + equipo) manda la última vez que se hizo: si esa tiene una
 * «próxima vez», esa es la fecha que cuenta, así que una tarea ya repetida no queda como atrasada. `dias` negativo = atrasada.
 */
export function pendientesMantenimiento<T extends { tipo: string; equipo: string | null; fecha: string; created_at: string; proxima_fecha: string | null }>(
  filas: T[],
  hoy: string,
  diasAviso = 7,
): PendienteEquipo<T>[] {
  const ultimas = new Map<string, T>();
  for (const f of filas) {
    const clave = `${f.tipo}|${(f.equipo ?? "").trim().toLowerCase()}`;
    const previa = ultimas.get(clave);
    if (!previa || f.fecha > previa.fecha || (f.fecha === previa.fecha && f.created_at > previa.created_at)) ultimas.set(clave, f);
  }
  const dia = (iso: string) => Math.round(new Date(`${iso}T12:00:00Z`).getTime() / 86_400_000);
  return [...ultimas.values()]
    .filter((f) => f.proxima_fecha)
    .map((f) => ({ registro: f, dias: dia(f.proxima_fecha!) - dia(hoy) }))
    .filter((p) => p.dias <= diasAviso)
    .sort((a, b) => a.dias - b.dias);
}

export const textoPlazo = (dias: number) =>
  dias < 0 ? `Atrasada ${-dias} ${-dias === 1 ? "día" : "días"}` : dias === 0 ? "Toca hoy" : dias === 1 ? "Toca mañana" : `Toca en ${dias} días`;
