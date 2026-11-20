import { sumarDias } from "@/lib/fechas";
import { turnosDe, type Turno } from "@/lib/ordeno";

/**
 * Registrar sin señal (modo sin señal, paso 3): reglas puras que usan la pantalla `/campo`, la captura de leche, la pesada de ceba, el motor de
 * envío y el servidor. Nada aquí toca el navegador ni la base: se prueba en `tests/campo.test.mjs`. Detalle en `docs/modulos/sin-senal.md`.
 */

export const RUTA_CAMPO = "/campo";
export const RUTA_REFERENCIA = "/api/campo/referencia";
export const RUTA_ENVIAR = "/api/campo/enviar";

/** Los mismos topes que los formularios con señal (`guardarOrdeno`, `guardarPeso`) y la base (`pesajes.peso_kg <= 250`). */
export const MAX_LITROS = 15;
export const MAX_PESO = 250;
/** Hasta cuántos días atrás se acepta un registro (igual que con señal). */
export const DIAS_ATRAS = 365;
/** Cada cuánto se renueva la copia de la finca guardada en el celular, si hay señal. */
export const MINUTOS_REFERENCIA = 15;
/** Lo ya enviado se sigue mostrando unos días (para ver qué se hizo en la jornada) y luego se borra del celular. */
export const DIAS_CONSERVAR_ENVIADOS = 3;
/** Cada cuánto se reintenta mientras haya algo por enviar (la señal débil no dispara ningún evento del navegador). */
export const SEGUNDOS_REINTENTO = 30;

export const MENSAJE_GUARDADO_LOCAL = "Guardado en el celular. Se enviará al volver la señal.";

export type JornadaCampo = Turno;

export type HembraCampo = {
  id: string;
  arete: string;
  nombre: string | null;
  /** Turnos programados; `null` = todos. */
  turnos: string[] | null;
  /** Último día de retiro de leche (inclusive), si está en retiro. */
  retiroLecheHasta: string | null;
};

export type AnimalPesar = {
  id: string;
  arete: string;
  nombre: string | null;
  /** Está en ceba (lote abierto, macho de carne o pesado hace poco): sale primero en la lista. */
  ceba: boolean;
  ultimoPeso: number | null;
  ultimaFecha: string | null;
};

/** Lo mínimo de la finca para registrar sin señal. Se guarda en el celular de quien abre la app con señal. */
export type ReferenciaCampo = {
  version: 1;
  generadaEn: string;
  hoy: string;
  usuario: { id: string };
  finca: { id: string; nombre: string };
  puede: { leche: boolean; pesos: boolean };
  ordeno: HembraCampo[];
  pesar: AnimalPesar[];
};

export type EstadoRegistro = "pendiente" | "enviando" | "error" | "enviado";

/** Un registro hecho en el celular. Su `id` es el identificador del envío (`client_request_id`): reenviarlo nunca duplica. */
export type RegistroCampo = {
  id: string;
  tipo: "ordeno" | "peso";
  usuarioId: string;
  fincaId: string;
  animalId: string;
  /** Arete y nombre para mostrar (el servidor no lo usa). */
  etiqueta: string;
  fecha: string;
  jornada?: JornadaCampo;
  litros?: number;
  descartar?: boolean;
  peso?: number;
  creadoEn: string;
  estado: EstadoRegistro;
  /** Por qué el servidor no lo aceptó (en palabras de persona). */
  error?: string;
  enviadoEn?: string;
  intentos: number;
};

/** Lo que viaja al servidor (sin lo que solo sirve en el celular). */
export type EnvioCampo =
  | { tipo: "ordeno"; id: string; fincaId: string; animalId: string; fecha: string; jornada: JornadaCampo; litros: number; descartar: boolean }
  | { tipo: "peso"; id: string; fincaId: string; animalId: string; fecha: string; peso: number };

export function envioDe(r: RegistroCampo): EnvioCampo {
  if (r.tipo === "ordeno") return { tipo: "ordeno", id: r.id, fincaId: r.fincaId, animalId: r.animalId, fecha: r.fecha, jornada: r.jornada!, litros: r.litros!, descartar: Boolean(r.descartar) };
  return { tipo: "peso", id: r.id, fincaId: r.fincaId, animalId: r.animalId, fecha: r.fecha, peso: r.peso! };
}

// ───────────── Validación (la misma en el celular y en el servidor) ─────────────

export function errorFecha(fecha: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "La fecha no es válida.";
  if (fecha > hoy) return "No se puede registrar un día que todavía no llega.";
  if (fecha < sumarDias(hoy, -DIAS_ATRAS)) return "Solo se pueden registrar datos de hasta un año atrás.";
  return null;
}

export function errorLitros(litros: number): string | null {
  if (!Number.isFinite(litros) || litros < 0) return "Escribe los litros.";
  if (litros > MAX_LITROS) return `Más de ${MAX_LITROS} litros en un ordeño no es posible. Revisa el dato.`;
  return null;
}

export function errorPeso(peso: number): string | null {
  if (!Number.isFinite(peso) || peso <= 0) return "Escribe el peso en kilos.";
  if (peso > MAX_PESO) return `El peso no puede pasar de ${MAX_PESO} kg.`;
  return null;
}

/** Un decimal, como lo guarda la base (`numeric(5,1)`). */
export const redondearPeso = (peso: number) => Math.round(peso * 10) / 10;

/** Lo que se escribe con el teclado propio («1.25», «32.») como número, o null si aún no hay número. */
export function numeroDeTexto(texto: string): number | null {
  if (texto === "" || texto === ".") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/** Una tecla del teclado propio sobre lo ya escrito, con un tope y un máximo de decimales. */
export function aplicarTecla(actual: string, tecla: string, tope: number, decimales: number): string {
  if (tecla === "borrar") return actual.slice(0, -1);
  if (tecla === ".") return actual.includes(".") ? actual : actual === "" ? "0." : `${actual}.`;
  if (!/^\d$/.test(tecla)) return actual;
  const nuevo = actual === "0" ? tecla : actual + tecla;
  const [, dec = ""] = nuevo.split(".");
  if (nuevo.includes(".") && dec.length > decimales) return actual;
  return Number(nuevo) > tope ? actual : nuevo;
}

/** La jornada que toca según la hora de Colombia (la misma regla de la captura de leche). */
export function jornadaDeHora(hora: number): JornadaCampo {
  return hora < 12 ? "manana" : hora < 19 ? "tarde" : "noche";
}

export function horaBogota(ahora = new Date()): number {
  return Number(new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(ahora)) % 24;
}

/** ¿Su leche se descarta ese día? (la base lo vuelve a decidir al guardar: esto solo avisa). */
export function enRetiroLeche(h: Pick<HembraCampo, "retiroLecheHasta">, fecha: string): boolean {
  return h.retiroLecheHasta !== null && fecha <= h.retiroLecheHasta;
}

/** Las hembras que se ordeñan en esa jornada, más las que ya tienen registro en ella (aunque se hayan reprogramado). */
export function hembrasDelTurno(hembras: HembraCampo[], jornada: JornadaCampo, conRegistro: ReadonlySet<string>): HembraCampo[] {
  return hembras.filter((h) => conRegistro.has(h.id) || turnosDe(h.turnos).includes(jornada));
}

/** Arete y nombre, como en el resto de la app. */
export const etiquetaCampo = (a: { arete: string; nombre: string | null }) => (a.nombre ? `${a.arete} · ${a.nombre}` : a.arete);

/** Busca sin tildes ni mayúsculas por arete o nombre. */
export function coincideBusqueda(a: { arete: string; nombre: string | null }, texto: string): boolean {
  const limpio = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = limpio(texto.trim());
  return q === "" || limpio(a.arete).includes(q) || limpio(a.nombre ?? "").includes(q);
}

// ───────────── La bandeja del celular ─────────────

/** El último registro de cada animal en esa fecha y jornada (o fecha, para el peso): es lo que se muestra en la lista. */
export function registrosDe(registros: RegistroCampo[], filtro: { tipo: "ordeno" | "peso"; fincaId: string; usuarioId: string; fecha: string; jornada?: JornadaCampo }): Map<string, RegistroCampo> {
  const salida = new Map<string, RegistroCampo>();
  const orden = [...registros].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  for (const r of orden) {
    if (r.tipo !== filtro.tipo || r.fincaId !== filtro.fincaId || r.usuarioId !== filtro.usuarioId || r.fecha !== filtro.fecha) continue;
    if (filtro.tipo === "ordeno" && r.jornada !== filtro.jornada) continue;
    salida.set(r.animalId, r);
  }
  return salida;
}

/** Cuántos faltan por enviar y cuántos tienen error, de esta persona; y cuántos son de otra cuenta en este celular. */
export function resumenBandeja(registros: RegistroCampo[], usuarioId: string | null): { porEnviar: number; conError: number; deOtraCuenta: number } {
  let porEnviar = 0;
  let conError = 0;
  let deOtraCuenta = 0;
  for (const r of registros) {
    if (r.estado === "enviado") continue;
    if (usuarioId !== null && r.usuarioId !== usuarioId) deOtraCuenta++;
    else if (r.estado === "error") conError++;
    else porEnviar++;
  }
  return { porEnviar, conError, deOtraCuenta };
}

/** Lo que sale en el orden de envío: primero lo más viejo. Solo los de la cuenta con la sesión abierta, y nunca los que tienen error. */
export function porEnviar(registros: RegistroCampo[], usuarioId: string): RegistroCampo[] {
  return registros.filter((r) => r.usuarioId === usuarioId && (r.estado === "pendiente" || r.estado === "enviando")).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

/** Lo enviado hace más de `DIAS_CONSERVAR_ENVIADOS` ya no hace falta en el celular. */
export function enviadosViejos(registros: RegistroCampo[], ahora: Date): RegistroCampo[] {
  const limite = ahora.getTime() - DIAS_CONSERVAR_ENVIADOS * 86_400_000;
  return registros.filter((r) => r.estado === "enviado" && r.enviadoEn !== undefined && Date.parse(r.enviadoEn) < limite);
}

export type RespuestaEnvio =
  | { ok: true; estado: "guardado" | "ya_estaba" }
  | { ok: false; codigo: "conflicto" | "rechazado"; error: string };

/**
 * Qué hacer con un registro según cómo respondió el servidor. Un corte de red, un error del servidor o una sesión vencida lo dejan
 * pendiente (se reintenta solo, nada se pierde). Un rechazo (dato que ya existía, animal que salió del hato, sin permiso) lo pasa a
 * «Pendientes con error» con el motivo: no se insiste solo.
 */
export function resultadoEnvio(status: number, cuerpo: unknown): { estado: "enviado" } | { estado: "pendiente"; sesion: boolean } | { estado: "error"; error: string } {
  if (status === 0 || status >= 500 || status === 408 || status === 429) return { estado: "pendiente", sesion: false };
  if (status === 401) return { estado: "pendiente", sesion: true };
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  if (status >= 200 && status < 300 && c.ok === true) return { estado: "enviado" };
  const texto = typeof c.error === "string" && c.error.trim() ? c.error : "No se pudo guardar este registro.";
  return { estado: "error", error: texto };
}

/** La copia de la finca: ¿hay que pedirla de nuevo? (vieja, de otra finca o de otra persona). */
export function referenciaVencida(ref: Pick<ReferenciaCampo, "generadaEn"> | null, ahora: Date): boolean {
  if (!ref) return true;
  return ahora.getTime() - Date.parse(ref.generadaEn) > MINUTOS_REFERENCIA * 60_000;
}

/** Lee una copia guardada y la descarta si no tiene la forma esperada (versión vieja, datos dañados). */
export function referenciaValida(valor: unknown): ReferenciaCampo | null {
  if (typeof valor !== "object" || valor === null) return null;
  const r = valor as Partial<ReferenciaCampo>;
  if (r.version !== 1 || typeof r.generadaEn !== "string" || typeof r.hoy !== "string") return null;
  if (!r.usuario?.id || !r.finca?.id || !Array.isArray(r.ordeno) || !Array.isArray(r.pesar) || !r.puede) return null;
  return r as ReferenciaCampo;
}
