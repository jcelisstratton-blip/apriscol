import { sumarDias } from "@/lib/fechas";
import { turnosDe, type Turno } from "@/lib/ordeno";
import type { Cobertura, Especie, EstadoRepro, EstadoUbicacion, LineaVenta, RubroGasto, IndicadorPalpacion, MetodoDiagnostico, ResultadoDiagnostico, SexoAnimal, TipoUbicacion, UsoUbicacion, ViabilidadFetal, Vocacion } from "@/lib/tipos";

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

/** Cada opción de «Registrar sin señal» (`components/campo/PantallaCampo.tsx`), más lo guardado. */
export type VistaCampo = "animal" | "ordeno" | "pesar" | "monta" | "diagnostico" | "parto" | "sanidad" | "corrales" | "compra" | "venta" | "baja" | "bandeja";

/**
 * Lo que se anota sin señal: una entrada por cada opción de «Registrar sin señal», en el mismo orden, con un detalle corto. La usan la pantalla de
 * entrada (tarjetas con la escena de `lib/escenas-campo.ts`), la ayuda y las preguntas frecuentes; `tests/campo.test.mjs` exige que tenga tantas
 * entradas como opciones la pantalla.
 */
export const REGISTROS_SIN_SENAL: readonly { vista: Exclude<VistaCampo, "bandeja">; titulo: string; detalle: string }[] = [
  { vista: "animal", titulo: "Animal nuevo", detalle: "Con arete, raza y padres" },
  { vista: "ordeno", titulo: "Ordeño", detalle: "Litros por jornada" },
  { vista: "pesar", titulo: "Pesos", detalle: "Peso del día" },
  { vista: "monta", titulo: "Monta", detalle: "Con su reproductor" },
  { vista: "diagnostico", titulo: "Diagnóstico de gestación", detalle: "Ecografía o palpación" },
  { vista: "parto", titulo: "Parto y crías", detalle: "Las crías entran al hato" },
  { vista: "sanidad", titulo: "Sanidad", detalle: "Vacunas y tratamientos" },
  { vista: "corrales", titulo: "Mover de corral", detalle: "Uno o todo el lote" },
  { vista: "compra", titulo: "Compras", detalle: "Alimento, droga…" },
  { vista: "venta", titulo: "Ventas", detalle: "Queso, carne, abono…" },
  { vista: "baja", titulo: "Dar de baja", detalle: "Venta, muerte…" },
];

/** Lo mismo en una frase («animal nuevo, ordeño, pesos… y dar de baja»). */
export const textoRegistrosSinSenal = () => {
  const l = REGISTROS_SIN_SENAL.map((r, i) => (i === 0 ? r.titulo : r.titulo.charAt(0).toLowerCase() + r.titulo.slice(1)));
  return `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`;
};

/** Lo que dice la pantalla de entrada cuando se intenta entrar sin señal (lo escrito no se borra). */
export const SIN_SENAL_ENTRAR = "Sin señal no se puede entrar. Lo que escribiste sigue aquí: inténtalo cuando vuelva la señal.";

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

/** Una hembra para la monta o el diagnóstico: su estado reproductivo de cuando se guardó la copia. */
export type HembraRepro = {
  id: string;
  arete: string;
  nombre: string | null;
  especie: string;
  nacimiento: string | null;
  estado: EstadoRepro;
  /** Último servicio (monta, inseminación…) del ciclo, si lo hay. */
  ultimoServicio: string | null;
};

/** Un reproductor del hato para la monta. */
export type MachoCampo = { id: string; arete: string; nombre: string | null; especie: string };

/** Una raza del catálogo (para el animal nuevo). */
export type RazaCampo = { id: number; especie: Especie; nombre: string; cobertura: Cobertura | null };

/** Un animal de la finca para elegir padre o madre y comprobar que el arete no se repita (también los que ya salieron). */
export type AnimalHato = {
  id: string;
  arete: string;
  nombre: string | null;
  sexo: SexoAnimal;
  especie: Especie;
  activo: boolean;
  /** Corrales: la instalación donde está hoy (`null` = sin ubicación). Solo viene si la persona mueve animales. */
  ubicacion?: string | null;
};

/** Un corral o potrero activo de la finca (para mover animales sin señal). La ocupación se calcula con `ubicacionesEfectivas`. */
export type UbicacionCampo = {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  uso: UsoUbicacion;
  capacidad: number | null;
  estado: EstadoUbicacion;
  diasDescanso: number | null;
  diasDescansoMin: number;
};

/** Un producto de compra del catálogo de la finca, con su rubro, su unidad y el último precio pagado. */
export type ProductoCompraCampo = { id: string; nombre: string; rubro: RubroGasto; unidad: string | null; precio: number | null; orden: number };

/** Lo que pide una compra sin señal: catálogo, proveedores, lotes de ceba, productos veterinarios (para el lote), especies, IVA y si el plan tiene Sanidad. */
export type ComprasCampo = {
  productos: ProductoCompraCampo[];
  proveedores: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
  productosVet: { id: string; nombre: string }[];
  especies: Especie[];
  ivaDefecto: number | null;
  conSanidad: boolean;
};

/** Un producto de venta que se registra a mano (no la leche cruda ni los animales, que entran solos), con su línea, su unidad y el último precio. */
export type ProductoVentaCampo = { id: string; nombre: string; linea: LineaVenta; unidad: string | null; precio: number | null; orden: number };

/** Lo que pide una venta sin señal (el IVA predeterminado es el mismo de `compras`). Los compradores también llegan a quien da de baja animales (una salida puede ser una venta). */
export type VentasCampo = { productos: ProductoVentaCampo[]; compradores: { id: string; nombre: string }[] };

export const VENTAS_VACIAS: VentasCampo = { productos: [], compradores: [] };

export const COMPRAS_VACIAS: ComprasCampo = { productos: [], proveedores: [], lotes: [], productosVet: [], especies: [], ivaDefecto: null, conSanidad: false };

/** Lo mínimo de la finca para registrar sin señal. Se guarda en el celular de quien abre la app con señal. */
export type ReferenciaCampo = {
  version: 7;
  generadaEn: string;
  hoy: string;
  usuario: { id: string };
  /** `moneda`: la de la finca (ISO 4217) para escribir el dinero de una compra; sin ella, la de fábrica. */
  finca: { id: string; nombre: string; moneda?: string };
  puede: { leche: boolean; pesos: boolean; reproduccion: boolean; hato: boolean; sanidad: boolean; lotes: boolean; corrales: boolean; compras: boolean; ventas: boolean };
  ordeno: HembraCampo[];
  pesar: AnimalPesar[];
  /** Hembras activas y reproductores (solo si la persona registra reproducción). */
  hembras: HembraRepro[];
  machos: MachoCampo[];
  /** Para crear animales (solo si la persona registra en el Hato): especies de la finca, su propósito, razas y animales. */
  especies: Especie[];
  proposito: Vocacion;
  razas: RazaCampo[];
  animales: AnimalHato[];
  /** Para Sanidad: el catálogo de productos veterinarios de la finca (los animales salen de `animales`). */
  productos: ProductoCampo[];
  /** Para Corrales: las instalaciones activas (dónde está cada animal va en `animales`). */
  ubicaciones: UbicacionCampo[];
  /** Para Compras (solo quien registra compras). */
  compras: ComprasCampo;
  /** Para Ventas (solo quien registra ventas). */
  ventas: VentasCampo;
};

export type TipoRegistroCampo = "ordeno" | "peso" | "monta" | "diagnostico" | "animal" | "sanidad" | "servicio" | "movimiento" | "compra" | "venta" | "baja" | "parto";

/** Lo que se anota en un diagnóstico de gestación sin señal (ecografía o palpación). */
export type DiagnosticoCampo = {
  /** En «Registrar sin señal», ecografía o palpación; desde la ficha (respaldo sin señal) también «otro método». */
  metodo: MetodoDiagnostico;
  resultado: ResultadoDiagnostico;
  diasGestacion?: number | null;
  numFetos?: number | null;
  viabilidad?: ViabilidadFetal | null;
  indicador?: IndicadorPalpacion | null;
  condicion?: number | null;
  pruebaNombre?: string | null;
  pruebaResultado?: string | null;
  responsable?: string | null;
  observaciones?: string | null;
};

/** Un producto veterinario del catálogo de la finca (para Sanidad sin señal). */
export type ProductoCampo = { id: string; nombre: string; tipo: string; retiroLeche: number; retiroCarne: number; unidad: string | null };

export type EstadoRegistro = "pendiente" | "enviando" | "error" | "enviado";

/** Un registro hecho en el celular. Su `id` es el identificador del envío (`client_request_id`): reenviarlo nunca duplica. */
export type RegistroCampo = {
  id: string;
  tipo: TipoRegistroCampo;
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
  /** Monta: el reproductor del hato o el nombre del de otra finca, y cómo se muestra. */
  machoId?: string | null;
  machoExterno?: string | null;
  machoEtiqueta?: string;
  /** Diagnóstico de gestación. */
  diagnostico?: DiagnosticoCampo;
  /**
   * Los mismos campos (texto) que envía el formulario con señal: animal nuevo (`animalId` es el propio identificador del registro), sanidad,
   * servicio desde la ficha, lo extra de un peso desde la ficha (tipo, condición corporal, observaciones) el movimiento a un corral, la compra, la venta (en estas dos, `animalId` es el propio identificador del registro) la baja de un animal y el parto (con sus crías en `crias`, como texto JSON igual que el formulario).
   */
  campos?: Record<string, string>;
  /** Sanidad y movimiento: los animales del registro (`animalId` es el primero). */
  animales?: string[];
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
  | { tipo: "peso"; id: string; fincaId: string; animalId: string; fecha: string; peso: number; extras?: Record<string, string> }
  | { tipo: "monta"; id: string; fincaId: string; animalId: string; fecha: string; machoId: string | null; machoExterno: string | null }
  | ({ tipo: "diagnostico"; id: string; fincaId: string; animalId: string; fecha: string } & DiagnosticoCampo)
  | { tipo: "animal"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> }
  | { tipo: "servicio"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> }
  | { tipo: "sanidad"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string>; animales: string[] }
  /** `creadoEn`: cuándo se anotó en el celular; un movimiento registrado DESPUÉS por otra persona no se pisa. */
  | { tipo: "movimiento"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string>; animales: string[]; creadoEn: string }
  | { tipo: "compra"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> }
  | { tipo: "venta"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> }
  | { tipo: "baja"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> }
  | { tipo: "parto"; id: string; fincaId: string; animalId: string; fecha: string; campos: Record<string, string> };

export function envioDe(r: RegistroCampo): EnvioCampo {
  const base = { id: r.id, fincaId: r.fincaId, animalId: r.animalId, fecha: r.fecha };
  if (r.tipo === "ordeno") return { tipo: "ordeno", ...base, jornada: r.jornada!, litros: r.litros!, descartar: Boolean(r.descartar) };
  if (r.tipo === "monta") return { tipo: "monta", ...base, machoId: r.machoId ?? null, machoExterno: r.machoExterno ?? null };
  if (r.tipo === "diagnostico") return { tipo: "diagnostico", ...base, ...r.diagnostico! };
  if (r.tipo === "animal") return { tipo: "animal", ...base, campos: r.campos ?? {} };
  if (r.tipo === "servicio") return { tipo: "servicio", ...base, campos: r.campos ?? {} };
  if (r.tipo === "sanidad") return { tipo: "sanidad", ...base, campos: r.campos ?? {}, animales: r.animales ?? [] };
  if (r.tipo === "compra") return { tipo: "compra", ...base, campos: r.campos ?? {} };
  if (r.tipo === "venta") return { tipo: "venta", ...base, campos: r.campos ?? {} };
  if (r.tipo === "baja") return { tipo: "baja", ...base, campos: r.campos ?? {} };
  if (r.tipo === "parto") return { tipo: "parto", ...base, campos: r.campos ?? {} };
  if (r.tipo === "movimiento") return { tipo: "movimiento", ...base, campos: r.campos ?? {}, animales: r.animales ?? [], creadoEn: r.creadoEn };
  return { tipo: "peso", ...base, peso: r.peso!, ...(r.campos && Object.keys(r.campos).length > 0 ? { extras: r.campos } : {}) };
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
export function registrosDe(registros: RegistroCampo[], filtro: { tipo: TipoRegistroCampo; fincaId: string; usuarioId: string; fecha: string; jornada?: JornadaCampo }): Map<string, RegistroCampo> {
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

/**
 * Lee una copia guardada y la descarta si está dañada. Las copias de versiones anteriores (1: ordeño y pesos; 2: más monta y diagnóstico;
 * 3: más animal nuevo; 4: más sanidad; 5: más corrales; 6: más compras) siguen sirviendo para lo que ya traían: se completan vacías hasta que la app se abra con señal y traiga la nueva.
 */
export function referenciaValida(valor: unknown): ReferenciaCampo | null {
  if (typeof valor !== "object" || valor === null) return null;
  const r = valor as Omit<Partial<ReferenciaCampo>, "version" | "puede"> & { version?: number; puede?: Partial<ReferenciaCampo["puede"]> };
  if (![1, 2, 3, 4, 5, 6, 7].includes(r.version ?? 0) || typeof r.generadaEn !== "string" || typeof r.hoy !== "string") return null;
  if (!r.usuario?.id || !r.finca?.id || !Array.isArray(r.ordeno) || !Array.isArray(r.pesar) || !r.puede) return null;
  const v = r.version!;
  if (v >= 2 && (!Array.isArray(r.hembras) || !Array.isArray(r.machos))) return null;
  if (v >= 3 && (!Array.isArray(r.especies) || !Array.isArray(r.razas) || !Array.isArray(r.animales))) return null;
  if (v >= 4 && !Array.isArray(r.productos)) return null;
  if (v >= 5 && !Array.isArray(r.ubicaciones)) return null;
  if (v >= 6 && (typeof r.compras !== "object" || r.compras === null || !Array.isArray(r.compras.productos))) return null;
  if (v >= 7 && (typeof r.ventas !== "object" || r.ventas === null || !Array.isArray(r.ventas.productos) || !Array.isArray(r.ventas.compradores))) return null;
  const puede = {
    leche: Boolean(r.puede.leche),
    pesos: Boolean(r.puede.pesos),
    reproduccion: v >= 2 && Boolean(r.puede.reproduccion),
    hato: v >= 3 && Boolean(r.puede.hato),
    sanidad: v >= 4 && Boolean(r.puede.sanidad),
    lotes: v >= 4 && Boolean(r.puede.lotes),
    corrales: v >= 5 && Boolean(r.puede.corrales),
    compras: v >= 6 && Boolean(r.puede.compras),
    ventas: v >= 7 && Boolean(r.puede.ventas),
  };
  return {
    ...(r as ReferenciaCampo),
    version: 7,
    puede,
    hembras: r.hembras ?? [],
    machos: r.machos ?? [],
    especies: r.especies ?? [],
    proposito: r.proposito ?? "leche",
    razas: r.razas ?? [],
    animales: r.animales ?? [],
    productos: r.productos ?? [],
    ubicaciones: r.ubicaciones ?? [],
    compras: r.compras ?? COMPRAS_VACIAS,
    ventas: r.ventas ?? VENTAS_VACIAS,
  };
}

// ───────────── Animal nuevo ─────────────

/** El arete como lo compara la base (`animales_arete_uk`: sin espacios a los lados y sin mayúsculas). */
export const areteClave = (arete: string) => arete.trim().toLowerCase();

/**
 * ¿Ese arete ya está en la finca (según la copia) o en un animal nuevo guardado en este celular que aún no se envió? Solo avisa: la base lo
 * vuelve a comprobar al enviar. `excepto`: el registro que se está corrigiendo.
 */
export function areteRepetido(arete: string, ref: Pick<ReferenciaCampo, "animales">, registros: RegistroCampo[], excepto?: string): boolean {
  const clave = areteClave(arete);
  if (!clave) return false;
  if (ref.animales.some((a) => areteClave(a.arete) === clave)) return true;
  return registros.some((r) => {
    if (r.id === excepto || r.estado === "enviado" || r.estado === "error") return false;
    if (r.tipo === "animal") return areteClave(r.campos?.numero_arete ?? "") === clave;
    // Las crías con arete de un parto guardado en el celular también serán animales del hato.
    if (r.tipo === "parto") return aretesDeCrias(r.campos?.crias).some((a) => areteClave(a) === clave);
    return false;
  });
}

/** Los aretes de las crías de un parto guardado en el celular (`campos.crias`, texto JSON). */
export function aretesDeCrias(crias: string | undefined): string[] {
  if (!crias) return [];
  try {
    const lista: unknown = JSON.parse(crias);
    return Array.isArray(lista) ? lista.map((c) => (typeof c?.arete === "string" ? c.arete.trim() : "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Padres posibles: machos (o hembras) de la misma especie, también los que ya salieron del hato, como en la ficha. */
export function padresPosibles(ref: Pick<ReferenciaCampo, "animales">, especie: Especie, sexo: SexoAnimal): AnimalHato[] {
  return ref.animales.filter((a) => a.especie === especie && a.sexo === sexo).sort((a, b) => Number(b.activo) - Number(a.activo) || a.arete.localeCompare(b.arete, "es", { numeric: true }));
}

// ───────────── Monta y diagnóstico ─────────────

/** Condición corporal por medios puntos (escala 1 a 5). */
export const CONDICIONES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
export const MAX_DIAS_GESTACION = 200;

/** Cómo se muestra el reproductor de una monta. */
export const etiquetaMacho = (m: { arete: string; nombre: string | null }) => etiquetaCampo(m);

/** Los reproductores de la misma especie que la hembra (el servidor lo vuelve a exigir). */
export function machosPara(machos: MachoCampo[], especie: string): MachoCampo[] {
  return machos.filter((m) => m.especie === especie);
}

/** El nombre de un macho de otra finca: sin espacios de sobra y hasta 80 letras (como en la ficha). */
export function nombreMachoExterno(texto: string): string | null {
  const t = texto.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 80) : null;
}

/** Hembras para diagnosticar: primero las servidas (esperan diagnóstico), luego el resto. */
export function hembrasParaDiagnostico(hembras: HembraRepro[]): HembraRepro[] {
  return [...hembras].sort((a, b) => Number(b.estado === "servida") - Number(a.estado === "servida") || a.arete.localeCompare(b.arete, "es", { numeric: true }));
}

// ───────────── Corrales: mover animales ─────────────

/**
 * Dónde está cada animal activo según la copia de la finca MÁS los movimientos de esta persona guardados en el celular que aún no se envían (en el
 * orden en que se anotaron), sin contar el que se está corrigiendo. Así, mover un lote dos veces seguidas sin señal cuenta bien el cupo.
 */
export function ubicacionesEfectivas(ref: Pick<ReferenciaCampo, "animales" | "finca">, registros: RegistroCampo[], usuarioId: string, excepto?: string): Map<string, string | null> {
  const donde = new Map<string, string | null>();
  for (const a of ref.animales) if (a.activo) donde.set(a.id, a.ubicacion ?? null);
  const propios = registros
    .filter((r) => r.tipo === "movimiento" && r.id !== excepto && r.usuarioId === usuarioId && r.fincaId === ref.finca.id && r.estado !== "enviado" && r.estado !== "error")
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  for (const r of propios) {
    const destino = r.campos?.sin_destino === "si" ? null : (r.campos?.destino ?? null);
    for (const id of r.animales ?? []) if (donde.has(id)) donde.set(id, destino);
  }
  return donde;
}

/** Cuántos animales hay en cada instalación según `ubicacionesEfectivas`. */
export function ocupacion(donde: Map<string, string | null>): Map<string, number> {
  const n = new Map<string, number>();
  for (const u of donde.values()) if (u) n.set(u, (n.get(u) ?? 0) + 1);
  return n;
}

// ───────────── Dar de baja ─────────────

/** Los animales que ya tienen una baja guardada en este celular, sin enviar (no se ofrecen de nuevo). `excepto`: la que se está corrigiendo. */
export function conBajaPendiente(registros: RegistroCampo[], usuarioId: string, fincaId: string, excepto?: string): Set<string> {
  return pendientesDe("baja", registros, usuarioId, fincaId, excepto);
}

/** Las hembras que ya tienen un parto guardado en este celular, sin enviar (no se ofrecen de nuevo). */
export function conPartoPendiente(registros: RegistroCampo[], usuarioId: string, fincaId: string, excepto?: string): Set<string> {
  return pendientesDe("parto", registros, usuarioId, fincaId, excepto);
}

function pendientesDe(tipo: TipoRegistroCampo, registros: RegistroCampo[], usuarioId: string, fincaId: string, excepto?: string): Set<string> {
  return new Set(registros.filter((r) => r.tipo === tipo && r.id !== excepto && r.usuarioId === usuarioId && r.fincaId === fincaId && r.estado !== "enviado").map((r) => r.animalId));
}

/** Hembras para el parto: primero las gestantes y servidas (las que esperan parir), luego el resto. */
export function hembrasParaParto(hembras: HembraRepro[]): HembraRepro[] {
  const espera = (h: HembraRepro) => h.estado === "gestante" || h.estado === "servida";
  return [...hembras].sort((a, b) => Number(espera(b)) - Number(espera(a)) || a.arete.localeCompare(b.arete, "es", { numeric: true }));
}
