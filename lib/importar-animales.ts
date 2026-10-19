import { leerNumero } from "@/lib/numeros";

/**
 * Cargue masivo de animales desde una plantilla de Excel. Aquí vive todo lo que NO depende de Excel ni de la base: las columnas de la
 * plantilla, la lectura de cada celda a la colombiana y las reglas de cada fila, incluida la genealogía (padres por arete, dentro del
 * archivo o ya en el hato). Las reglas espejan a `crearAnimal` y al disparador `private.animales_validar`; la base las vuelve a exigir.
 */

export const MAX_FILAS_IMPORTAR = 500;
export const MAX_BYTES_IMPORTAR = 2 * 1024 * 1024;

export type Especie = "caprino" | "ovino";

export const COLUMNAS = [
  { id: "especie", titulo: "Especie", requerida: false, ancho: 12, ayuda: "Caprino (cabras) u Ovino (ovejas). Si tu finca solo tiene una especie, puedes dejarla vacía." },
  { id: "numero_arete", titulo: "Número de arete", requerida: true, ancho: 16, ayuda: "El identificador del animal. No puede repetirse en tu finca." },
  { id: "nombre", titulo: "Nombre", requerida: false, ancho: 18, ayuda: "Opcional." },
  { id: "sexo", titulo: "Sexo", requerida: true, ancho: 10, ayuda: "Hembra o Macho." },
  { id: "raza", titulo: "Raza", requerida: false, ancho: 20, ayuda: "Elige de la lista (hoja «Listas»): debe ser de la misma especie del animal." },
  { id: "fecha_nacimiento", titulo: "Fecha de nacimiento", requerida: false, ancho: 16, ayuda: "Día/mes/año, por ejemplo 15/03/2023." },
  { id: "nacimiento_aprox", titulo: "Nacimiento aproximado", requerida: false, ancho: 14, ayuda: "Sí si la fecha de nacimiento es un cálculo, no un dato exacto." },
  { id: "padre_arete", titulo: "Arete del padre", requerida: false, ancho: 16, ayuda: "El arete de un macho que está en este archivo o que ya está en tu hato. Así se arma la genealogía." },
  { id: "madre_arete", titulo: "Arete de la madre", requerida: false, ancho: 16, ayuda: "El arete de una hembra que está en este archivo o que ya está en tu hato." },
  { id: "padre_externo", titulo: "Padre (si no está en tu hato)", requerida: false, ancho: 22, ayuda: "Nombre o registro del padre cuando no es un animal tuyo (semental ajeno, pajilla de semen)." },
  { id: "madre_externa", titulo: "Madre (si no está en tu hato)", requerida: false, ancho: 22, ayuda: "Nombre o registro de la madre cuando no es un animal tuyo." },
  { id: "origen", titulo: "Origen", requerida: false, ancho: 18, ayuda: "Nació en la finca (por defecto) o Comprado." },
  { id: "aptitud", titulo: "Aptitud (hembras)", requerida: false, ancho: 14, ayuda: "Leche, Carne o Doble. Solo para hembras; si la dejas vacía queda en Leche." },
  { id: "uso_macho", titulo: "Uso del macho", requerida: false, ancho: 16, ayuda: "Reproductor, Carne o Por definir. Solo para machos." },
  { id: "fecha_ultimo_parto", titulo: "Fecha del último parto", requerida: false, ancho: 18, ayuda: "Solo hembras que ya parieron: abre su lactancia. Debe ser posterior a su nacimiento." },
  { id: "partos_total", titulo: "Número de partos", requerida: false, ancho: 12, ayuda: "Cuántos partos lleva la hembra en total (contando el último). Si pones fecha del último parto y lo dejas vacío, se toma 1." },
  { id: "fecha_servicio", titulo: "Fecha del último servicio", requerida: false, ancho: 18, ayuda: "Solo hembras servidas que aún no han parido: la fecha de la monta o inseminación. De ahí sale la fecha prevista de parto." },
  { id: "tipo_servicio", titulo: "Tipo de servicio", requerida: false, ancho: 18, ayuda: "Monta natural (por defecto), Inseminación o Transferencia de embrión." },
  { id: "semental_arete", titulo: "Arete del semental", requerida: false, ancho: 16, ayuda: "El macho que la sirvió, si está en este archivo o en tu hato." },
  { id: "semental_externo", titulo: "Semental (si no está en tu hato)", requerida: false, ancho: 22, ayuda: "Nombre o registro del macho cuando no es tuyo (semental prestado, pajilla de semen)." },
  { id: "prenez_confirmada", titulo: "Preñez confirmada", requerida: false, ancho: 14, ayuda: "Sí si ya se confirmó (ecografía, palpación…). Queda registrada con la fecha de hoy; sin confirmar queda como «servida»." },
  { id: "peso_nacer_kg", titulo: "Peso al nacer (kg)", requerida: false, ancho: 14, ayuda: "Entre 0,1 y 15 kg. Solo para animales que nacieron en la finca." },
  { id: "chip", titulo: "Microchip", requerida: false, ancho: 18, ayuda: "Opcional." },
  { id: "color", titulo: "Color", requerida: false, ancho: 14, ayuda: "Opcional." },
  { id: "marcas", titulo: "Marcas", requerida: false, ancho: 18, ayuda: "Opcional." },
  { id: "valor_compra", titulo: "Valor de compra ($)", requerida: false, ancho: 16, ayuda: "En pesos. Solo para animales comprados: cuenta como costo en la fecha de compra." },
  { id: "fecha_compra", titulo: "Fecha de compra", requerida: false, ancho: 16, ayuda: "Solo para animales comprados." },
  { id: "ubicacion", titulo: "Corral o potrero", requerida: false, ancho: 20, ayuda: "Dónde está hoy el animal. Elige de la lista (los corrales y potreros que ya creaste en Hato → Corrales); respeta el cupo de cada uno." },
  { id: "notas", titulo: "Notas", requerida: false, ancho: 28, ayuda: "Opcional." },
] as const;

/** Columnas que solo se ofrecen si la finca puede registrar reproducción o ubicaciones (plan y rol). */
export const COLUMNAS_REPRODUCCION = ["fecha_servicio", "tipo_servicio", "semental_arete", "semental_externo", "prenez_confirmada"] as const;
export const COLUMNA_UBICACION = "ubicacion" as const;
export const LISTA_TIPO_SERVICIO = ["Monta natural", "Inseminación", "Transferencia de embrión"] as const;

export type ColumnaId = (typeof COLUMNAS)[number]["id"];
export type CeldaCruda = string | number | boolean | Date | null | undefined;
export type FilaCruda = { fila: number; valores: Partial<Record<ColumnaId, CeldaCruda>> };

export type RazaRef = { id: number; especie: Especie; nombre: string };
export type AnimalExistente = { numero_arete: string; sexo: "hembra" | "macho"; especie: Especie; fecha_nacimiento: string | null };
export type UbicacionRef = { id: string; nombre: string; capacidad: number | null; ocupantes: number };
export type ContextoImportar = {
  /** Especies activas de la finca. */
  especies: Especie[];
  razas: RazaRef[];
  existentes: AnimalExistente[];
  /** Hoy en Colombia (AAAA-MM-DD). */
  hoy: string;
  /** Aptitud de las hembras cuando la plantilla no la trae. */
  aptitudDefecto?: "leche" | "carne" | "doble";
  /** Puede registrar servicios y preñez (módulo de reproducción en su plan y rol). */
  reproduccion?: boolean;
  /** Corrales y potreros activos. `undefined`: no puede asignar ubicaciones (plan o rol); `[]`: puede, pero aún no creó ninguno. */
  ubicaciones?: UbicacionRef[];
};

/** Lo que recibe `importar_animales_lote` por animal. */
export type FilaParaGuardar = {
  fila: number;
  numero_arete: string;
  especie: Especie;
  nombre?: string;
  sexo: "hembra" | "macho";
  raza_id?: number;
  fecha_nacimiento?: string;
  fecha_nacimiento_aprox: boolean;
  padre_arete?: string;
  madre_arete?: string;
  padre_externo?: string;
  madre_externa?: string;
  origen: "nacido_en_finca" | "comprado";
  vocacion: "leche" | "carne" | "doble";
  uso_macho?: "reproductor" | "carne";
  fecha_ultimo_parto?: string;
  partos_total?: number;
  fecha_servicio?: string;
  tipo_servicio?: "monta_natural" | "inseminacion" | "transferencia_embrionaria";
  semental_arete?: string;
  semental_externo?: string;
  prenez_confirmada?: boolean;
  ubicacion_id?: string;
  peso_nacer_kg?: number;
  chip?: string;
  color?: string;
  marcas?: string;
  valor_compra?: number;
  fecha_compra?: string;
  notas?: string;
};

export type FilaVista = {
  fila: number;
  numero_arete: string;
  nombre: string | null;
  especie: Especie;
  sexo: "hembra" | "macho";
  raza: string | null;
  fecha_nacimiento: string | null;
  padre: string | null;
  madre: string | null;
  origen: "nacido_en_finca" | "comprado";
  /** Partos, servicio y preñez en una línea; null si no trae nada de eso. */
  repro: string | null;
  ubicacion: string | null;
};

export type ErrorFila = { fila: number; arete: string; mensajes: string[] };
export type ResultadoValidacion = {
  /** Filas listas, ya en el orden en que deben insertarse (padres antes que crías). Vacío si hay errores. */
  filas: FilaParaGuardar[];
  vista: FilaVista[];
  errores: ErrorFila[];
  resumen: { total: number; hembras: number; machos: number; con_padres_en_archivo: number; con_padres_en_hato: number; con_padres_externos: number; con_servicio: number; con_ubicacion: number };
};

// ───────────────────────── Lectura de celdas ─────────────────────────
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const claveEncabezado = (s: string) => normalizar(s).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const ALIAS_ENCABEZADO: Partial<Record<ColumnaId, string[]>> = {
  numero_arete: ["arete", "numero de arete", "n de arete", "no de arete", "numero arete"],
  nacimiento_aprox: ["nacimiento aprox", "fecha aproximada", "nacimiento aproximado"],
  padre_arete: ["arete padre", "arete del padre", "padre arete"],
  madre_arete: ["arete madre", "arete de la madre", "madre arete"],
  padre_externo: ["padre", "padre si no esta en tu hato", "padre externo"],
  semental_externo: ["semental", "semental si no esta en tu hato", "semental externo"],
  semental_arete: ["arete semental", "arete del semental"],
  fecha_servicio: ["ultimo servicio", "fecha del ultimo servicio", "fecha servicio"],
  prenez_confirmada: ["prenez", "prenez confirmada", "gestante"],
  partos_total: ["partos", "numero de partos", "n de partos"],
  ubicacion: ["corral", "potrero", "corral o potrero", "ubicacion"],
  madre_externa: ["madre", "madre si no esta en tu hato", "madre externa"],
  aptitud: ["aptitud", "aptitud hembras", "vocacion"],
  fecha_ultimo_parto: ["ultimo parto", "fecha del ultimo parto", "fecha ultimo parto"],
  peso_nacer_kg: ["peso al nacer", "peso al nacer kg", "peso nacer kg"],
  valor_compra: ["valor de compra", "valor compra"],
};

/** Asocia cada encabezado del archivo con su columna (sin importar el orden, las tildes ni los asteriscos). */
export function mapearEncabezados(textos: string[]): { columnas: (ColumnaId | null)[]; faltan: string[] } {
  const porClave = new Map<string, ColumnaId>();
  for (const c of COLUMNAS) {
    porClave.set(claveEncabezado(c.titulo), c.id);
    for (const a of ALIAS_ENCABEZADO[c.id] ?? []) porClave.set(claveEncabezado(a), c.id);
  }
  const columnas = textos.map((t) => porClave.get(claveEncabezado(t)) ?? null);
  const faltan = COLUMNAS.filter((c) => c.requerida && !columnas.includes(c.id)).map((c) => c.titulo);
  return { columnas, faltan };
}

function texto(v: CeldaCruda): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
  return String(v).trim();
}

const fechaValida = (a: number, m: number, d: number) => {
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};
const aIso = (a: number, m: number, d: number) => `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Fecha de una celda: de Excel (Date o número de serie) o escrita como 15/03/2023 o 2023-03-15. */
function leerFecha(v: CeldaCruda): { valor?: string; error?: true } {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return {};
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? { error: true } : { valor: v.toISOString().slice(0, 10) };
  if (typeof v === "number") {
    if (v < 1 || v > 80000) return { error: true };
    return { valor: new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) };
  }
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t);
  if (m) return fechaValida(+m[1], +m[2], +m[3]) ? { valor: aIso(+m[1], +m[2], +m[3]) } : { error: true };
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t);
  if (m) return fechaValida(+m[3], +m[2], +m[1]) ? { valor: aIso(+m[3], +m[2], +m[1]) } : { error: true };
  return { error: true };
}

function leerSiNo(v: CeldaCruda): boolean | null {
  if (typeof v === "boolean") return v;
  const t = normalizar(texto(v));
  if (t === "") return false;
  if (["si", "s", "x", "1", "true", "verdadero", "yes"].includes(t)) return true;
  if (["no", "n", "0", "false", "falso"].includes(t)) return false;
  return null;
}

function leerEspecie(t: string): Especie | null {
  const n = normalizar(t);
  if (["caprino", "caprinos", "cabra", "cabras", "cabro", "cabros", "chivo", "chivos", "cabrito", "cabrita"].includes(n)) return "caprino";
  if (["ovino", "ovinos", "oveja", "ovejas", "carnero", "carneros", "borrego", "borregos", "cordero", "cordera"].includes(n)) return "ovino";
  return null;
}

const largo = (valor: string, max: number, nombre: string, errores: string[]) => {
  if (valor.length > max) errores.push(`${nombre} es muy largo (máximo ${max} caracteres).`);
};

// ───────────────────────── Validación de todas las filas ─────────────────────────
type Parcial = {
  cruda: FilaCruda;
  arete: string;
  clave: string;
  especie?: Especie;
  sexo?: "hembra" | "macho";
  nacimiento?: string;
  padreClave?: string;
  madreClave?: string;
  sementalClave?: string;
  ubicacion?: UbicacionRef;
  errores: string[];
  fila?: FilaParaGuardar;
  razaNombre?: string;
};

export function validarFilas(crudas: FilaCruda[], ctx: ContextoImportar): ResultadoValidacion {
  const vacio = { total: 0, hembras: 0, machos: 0, con_padres_en_archivo: 0, con_padres_en_hato: 0, con_padres_externos: 0, con_servicio: 0, con_ubicacion: 0 };
  const parciales: Parcial[] = crudas.map((cruda) => interpretarFila(cruda, ctx));

  const existentes = new Map(ctx.existentes.map((a) => [normalizar(a.numero_arete), a]));
  const enArchivo = new Map<string, Parcial>();
  for (const p of parciales) {
    if (!p.clave) continue;
    const previo = enArchivo.get(p.clave);
    if (previo) p.errores.push(`El arete «${p.arete}» se repite (ya está en la fila ${previo.cruda.fila}).`);
    else enArchivo.set(p.clave, p);
    if (existentes.has(p.clave)) p.errores.push(`Ya existe un animal con el arete «${p.arete}» en tu hato.`);
  }

  // Genealogía: cada padre/madre se busca primero en el archivo y luego en el hato.
  const sinPadre = (rol: "padre" | "madre") => (rol === "padre" ? "El padre" : "La madre");
  const dependeDe = new Map<Parcial, Parcial[]>();
  for (const p of parciales) {
    const deps: Parcial[] = [];
    for (const rol of ["padre", "madre"] as const) {
      const clave = rol === "padre" ? p.padreClave : p.madreClave;
      if (!clave) continue;
      const refTexto = rol === "padre" ? p.cruda.valores.padre_arete : p.cruda.valores.madre_arete;
      const etiqueta = `${sinPadre(rol)} con arete «${texto(refTexto)}»`;
      if (clave === p.clave) {
        p.errores.push(`${sinPadre(rol)} no puede ser el mismo animal.`);
        continue;
      }
      const enFila = enArchivo.get(clave);
      const enHato = existentes.get(clave);
      const ref = enFila
        ? { sexo: enFila.sexo, especie: enFila.especie, nacimiento: enFila.nacimiento }
        : enHato
          ? { sexo: enHato.sexo, especie: enHato.especie, nacimiento: enHato.fecha_nacimiento ?? undefined }
          : null;
      if (!ref) {
        p.errores.push(`${etiqueta} no está en este archivo ni en tu hato. Agrégalo al archivo (en una fila) o escríbelo en «${rol === "padre" ? "Padre" : "Madre"} (si no está en tu hato)».`);
        continue;
      }
      const sexoEsperado = rol === "padre" ? "macho" : "hembra";
      if (ref.sexo && ref.sexo !== sexoEsperado) p.errores.push(`${etiqueta} debe ser ${sexoEsperado === "macho" ? "un macho" : "una hembra"}.`);
      if (ref.especie && p.especie && ref.especie !== p.especie) p.errores.push(`${etiqueta} debe ser de la misma especie.`);
      if (ref.nacimiento && p.nacimiento && ref.nacimiento >= p.nacimiento) p.errores.push(`${etiqueta} debe haber nacido antes que la cría.`);
      if (enFila && !enHato) deps.push(enFila);
    }
    dependeDe.set(p, deps);
  }

  // Semental del servicio: debe ser un macho de la misma especie, del archivo o del hato.
  for (const p of parciales) {
    if (!p.sementalClave) continue;
    const enFila = enArchivo.get(p.sementalClave);
    const enHato = existentes.get(p.sementalClave);
    const ref = enFila ? { sexo: enFila.sexo, especie: enFila.especie } : enHato ? { sexo: enHato.sexo, especie: enHato.especie } : null;
    const etiqueta = `El semental con arete «${texto(p.cruda.valores.semental_arete)}»`;
    if (!ref) p.errores.push(`${etiqueta} no está en este archivo ni en tu hato. Agrégalo o escríbelo en «Semental (si no está en tu hato)».`);
    else {
      if (ref.sexo && ref.sexo !== "macho") p.errores.push(`${etiqueta} debe ser un macho.`);
      if (ref.especie && p.especie && ref.especie !== p.especie) p.errores.push(`${etiqueta} debe ser de la misma especie.`);
    }
  }

  // Cupo de cada corral: lo que ya hay más lo que pone el archivo no puede pasar de su capacidad (la base también lo exige).
  const puestos = new Map<string, number>();
  for (const p of parciales) {
    const u = p.ubicacion;
    if (!u) continue;
    const n = (puestos.get(u.id) ?? 0) + 1;
    puestos.set(u.id, n);
    if (u.capacidad !== null && u.ocupantes + n > u.capacidad) {
      const libres = Math.max(0, u.capacidad - u.ocupantes);
      p.errores.push(`«${u.nombre}» no tiene cupo: caben ${u.capacidad} y ya tiene ${u.ocupantes}${libres > 0 ? ` (el archivo solo puede poner ${libres})` : ""}.`);
    }
  }

  // Orden de inserción: padres antes que crías (Kahn, estable respecto al orden del archivo).
  const orden: Parcial[] = [];
  const hechos = new Set<Parcial>();
  let pendientes = parciales.filter((p) => p.clave);
  while (pendientes.length > 0) {
    const listos = pendientes.filter((p) => (dependeDe.get(p) ?? []).every((d) => hechos.has(d)));
    if (listos.length === 0) {
      for (const p of pendientes) p.errores.push("El parentesco forma un círculo (un animal sería su propio ancestro). Revisa los aretes del padre y la madre.");
      break;
    }
    for (const p of listos) {
      hechos.add(p);
      orden.push(p);
    }
    pendientes = pendientes.filter((p) => !hechos.has(p));
  }

  const errores: ErrorFila[] = parciales
    .filter((p) => p.errores.length > 0)
    .map((p) => ({ fila: p.cruda.fila, arete: p.arete, mensajes: p.errores }));
  if (errores.length > 0) return { filas: [], vista: [], errores, resumen: { ...vacio, total: parciales.length } };

  const filas = orden.map((p) => p.fila!);
  const nombreDe = (clave: string | undefined, externo: string | undefined, visto: string | undefined) => {
    if (clave) return `${visto} · ${enArchivo.has(clave) ? "en este archivo" : "en tu hato"}`;
    return externo ? `${externo} · de fuera` : null;
  };
  const vista: FilaVista[] = orden.map((p) => ({
    fila: p.cruda.fila,
    numero_arete: p.fila!.numero_arete,
    nombre: p.fila!.nombre ?? null,
    especie: p.fila!.especie,
    sexo: p.fila!.sexo,
    raza: p.razaNombre ?? null,
    fecha_nacimiento: p.fila!.fecha_nacimiento ?? null,
    padre: nombreDe(p.padreClave, p.fila!.padre_externo, p.fila!.padre_arete),
    madre: nombreDe(p.madreClave, p.fila!.madre_externa, p.fila!.madre_arete),
    origen: p.fila!.origen,
    repro: resumenRepro(p.fila!, p.sementalClave ? `${p.fila!.semental_arete} · ${enArchivo.has(p.sementalClave) ? "en este archivo" : "en tu hato"}` : p.fila!.semental_externo ? `${p.fila!.semental_externo} · de fuera` : null),
    ubicacion: p.ubicacion?.nombre ?? null,
  }));
  const resumen = {
    total: filas.length,
    hembras: filas.filter((f) => f.sexo === "hembra").length,
    machos: filas.filter((f) => f.sexo === "macho").length,
    con_padres_en_archivo: orden.filter((p) => [p.padreClave, p.madreClave].some((c) => c && enArchivo.has(c))).length,
    con_padres_en_hato: orden.filter((p) => [p.padreClave, p.madreClave].some((c) => c && !enArchivo.has(c) && existentes.has(c))).length,
    con_padres_externos: filas.filter((f) => f.padre_externo || f.madre_externa).length,
    con_servicio: filas.filter((f) => f.fecha_servicio).length,
    con_ubicacion: filas.filter((f) => f.ubicacion_id).length,
  };
  return { filas, vista, errores: [], resumen };
}

const ETIQUETA_TIPO_SERVICIO = { monta_natural: "Monta natural", inseminacion: "Inseminación", transferencia_embrionaria: "Transferencia de embrión" } as const;
const fechaLarga = (iso: string) => iso.split("-").reverse().join("/");

function resumenRepro(f: FilaParaGuardar, semental: string | null): string | null {
  const partes: string[] = [];
  if (f.partos_total !== undefined) partes.push(`${f.partos_total} ${f.partos_total === 1 ? "parto" : "partos"}`);
  if (f.fecha_servicio) {
    partes.push(`${f.prenez_confirmada ? "Preñada" : "Servida"} el ${fechaLarga(f.fecha_servicio)} · ${ETIQUETA_TIPO_SERVICIO[f.tipo_servicio ?? "monta_natural"]}${semental ? ` · ${semental}` : ""}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Lee una fila sola (sin mirar a las demás): tipos, listas, fechas, rangos y reglas propias del animal. */
function interpretarFila(cruda: FilaCruda, ctx: ContextoImportar): Parcial {
  const v = cruda.valores;
  const errores: string[] = [];
  const arete = texto(v.numero_arete);
  const p: Parcial = { cruda, arete, clave: normalizar(arete), errores };

  if (!arete) errores.push("Falta el número de arete.");
  largo(arete, 40, "El número de arete", errores);

  // Especie
  const crudaEspecie = texto(v.especie);
  let especie: Especie | undefined;
  if (crudaEspecie) {
    especie = leerEspecie(crudaEspecie) ?? undefined;
    if (!especie) errores.push(`La especie «${crudaEspecie}» no es válida (usa Caprino u Ovino).`);
    else if (!ctx.especies.includes(especie)) errores.push(`La especie «${crudaEspecie}» no está activa en tu finca.`);
  } else if (ctx.especies.length === 1) {
    especie = ctx.especies[0];
  } else {
    errores.push("Falta la especie (Caprino u Ovino).");
  }
  p.especie = especie;

  // Sexo
  const crudoSexo = normalizar(texto(v.sexo));
  let sexo: "hembra" | "macho" | undefined;
  if (!crudoSexo) errores.push("Falta el sexo (Hembra o Macho).");
  else if (["hembra", "h", "f", "femenino", "female"].includes(crudoSexo)) sexo = "hembra";
  else if (["macho", "m", "masculino", "male"].includes(crudoSexo)) sexo = "macho";
  else errores.push(`El sexo «${texto(v.sexo)}» no es válido (usa Hembra o Macho).`);
  p.sexo = sexo;

  // Texto libre
  const nombre = texto(v.nombre);
  const chip = texto(v.chip);
  const color = texto(v.color);
  const marcas = texto(v.marcas);
  const notas = texto(v.notas);
  const padreExterno = texto(v.padre_externo);
  const madreExterna = texto(v.madre_externa);
  largo(nombre, 60, "El nombre", errores);
  largo(chip, 40, "El microchip", errores);
  largo(color, 60, "El color", errores);
  largo(marcas, 120, "Las marcas", errores);
  largo(notas, 1000, "Las notas", errores);
  largo(padreExterno, 80, "El padre", errores);
  largo(madreExterna, 80, "La madre", errores);

  // Raza (de la misma especie)
  let razaId: number | undefined;
  const crudaRaza = texto(v.raza);
  if (crudaRaza && especie) {
    const n = normalizar(crudaRaza).replace(/^raza /, "");
    const r = ctx.razas.find((x) => x.especie === especie && normalizar(x.nombre) === n);
    if (!r) errores.push(`La raza «${crudaRaza}» no está en la lista de ${especie === "caprino" ? "cabras" : "ovejas"} (hoja «Listas»).`);
    else {
      razaId = r.id;
      p.razaNombre = r.nombre;
    }
  }

  // Fechas
  const hoy = ctx.hoy;
  const nac = leerFecha(v.fecha_nacimiento);
  if (nac.error) errores.push("La fecha de nacimiento no es válida (usa día/mes/año, por ejemplo 15/03/2023).");
  else if (nac.valor && (nac.valor > hoy || nac.valor < "1990-01-01")) errores.push("La fecha de nacimiento debe estar entre 1990 y hoy.");
  p.nacimiento = nac.valor;
  const aprox = leerSiNo(v.nacimiento_aprox);
  if (aprox === null) errores.push("«Nacimiento aproximado» debe ser Sí o No.");

  const parto = leerFecha(v.fecha_ultimo_parto);
  if (parto.error) errores.push("La fecha del último parto no es válida (usa día/mes/año).");
  else if (parto.valor) {
    if (sexo === "macho") errores.push("Solo una hembra puede tener un parto.");
    else if (parto.valor > hoy) errores.push("La fecha del último parto no puede ser futura.");
    else if (nac.valor && parto.valor <= nac.valor) errores.push("El parto debe ser posterior al nacimiento de la hembra.");
  }

  // Partos y reproducción (partos totales, servicio, semental y preñez)
  const crudoPartos = texto(v.partos_total);
  let partosTotal: number | undefined;
  if (crudoPartos) {
    const n = leerNumero(crudoPartos);
    if (n === null || !Number.isInteger(n) || n < 0 || n > 30) errores.push("El número de partos debe ser un entero entre 0 y 30.");
    else if (sexo === "macho") errores.push("Solo una hembra tiene partos.");
    else partosTotal = n;
  }
  if (parto.valor && sexo === "hembra") {
    if (partosTotal === 0) errores.push("Si tiene fecha del último parto, el número de partos no puede ser 0.");
    else if (partosTotal === undefined && !errores.some((e) => e.startsWith("El número de partos"))) partosTotal = 1;
  }

  const serv = leerFecha(v.fecha_servicio);
  const crudoTipoServ = normalizar(texto(v.tipo_servicio));
  const sementalArete = texto(v.semental_arete);
  const sementalExterno = texto(v.semental_externo);
  const prenez = leerSiNo(v.prenez_confirmada);
  const traeServicio = !!(serv.valor || serv.error || crudoTipoServ || sementalArete || sementalExterno || prenez === true);
  let tipoServicio: FilaParaGuardar["tipo_servicio"];
  if (prenez === null) errores.push("«Preñez confirmada» debe ser Sí o No.");
  if (traeServicio) {
    if (!ctx.reproduccion) errores.push("Tu plan o tu rol no permite registrar servicios desde este archivo: deja vacías las columnas de servicio y preñez.");
    else if (sexo === "macho") errores.push("Solo una hembra tiene servicios.");
    else {
      if (serv.error) errores.push("La fecha del servicio no es válida (usa día/mes/año).");
      else if (!serv.valor) errores.push("Falta la fecha del último servicio (hay datos de servicio o preñez sin ella).");
      else if (serv.valor > hoy || serv.valor < "1990-01-01") errores.push("La fecha del servicio debe estar entre 1990 y hoy.");
      else if (nac.valor && serv.valor <= nac.valor) errores.push("El servicio debe ser posterior al nacimiento de la hembra.");
      else if (parto.valor && serv.valor <= parto.valor) errores.push("El servicio debe ser posterior a la fecha del último parto (si ya parió, el servicio es el siguiente).");
      if (!crudoTipoServ) tipoServicio = "monta_natural";
      else if (["monta natural", "monta", "natural"].includes(crudoTipoServ)) tipoServicio = "monta_natural";
      else if (["inseminacion", "inseminacion artificial", "ia"].includes(crudoTipoServ)) tipoServicio = "inseminacion";
      else if (["transferencia de embrion", "transferencia embrionaria", "transferencia", "te"].includes(crudoTipoServ)) tipoServicio = "transferencia_embrionaria";
      else errores.push(`El tipo de servicio «${texto(v.tipo_servicio)}» no es válido (usa Monta natural, Inseminación o Transferencia de embrión).`);
      if (sementalArete && sementalExterno) errores.push("Pon el semental por arete o por nombre, no los dos.");
      largo(sementalExterno, 80, "El semental", errores);
      if (sementalArete) p.sementalClave = normalizar(sementalArete);
    }
  }

  // Corral o potrero (de los que ya creó la finca)
  const crudaUbicacion = texto(v.ubicacion);
  if (crudaUbicacion) {
    if (ctx.ubicaciones === undefined) errores.push("Tu plan o tu rol no permite asignar corrales desde este archivo: deja vacía la columna «Corral o potrero».");
    else if (ctx.ubicaciones.length === 0) errores.push("Aún no tienes corrales ni potreros: créalos en Hato → Corrales y descarga la plantilla otra vez.");
    else {
      const u = ctx.ubicaciones.find((x) => normalizar(x.nombre) === normalizar(crudaUbicacion));
      if (!u) errores.push(`«${crudaUbicacion}» no es un corral ni un potrero de tu finca (elige de la lista de la hoja «Listas»).`);
      else p.ubicacion = u;
    }
  }

  // Origen y compra
  const crudoOrigen = normalizar(texto(v.origen));
  let origen: "nacido_en_finca" | "comprado" = "nacido_en_finca";
  if (crudoOrigen) {
    if (["comprado", "comprada", "compra", "comprado afuera"].includes(crudoOrigen)) origen = "comprado";
    else if (["nacio en la finca", "nacido en la finca", "nacido en finca", "nacio en finca", "finca", "propio", "nacido"].includes(crudoOrigen)) origen = "nacido_en_finca";
    else errores.push(`El origen «${texto(v.origen)}» no es válido (usa «Nació en la finca» o «Comprado»).`);
  }

  const crudoValor = texto(v.valor_compra);
  let valorCompra: number | undefined;
  if (crudoValor) {
    const n = leerNumero(crudoValor);
    if (n === null) errores.push("El valor de compra debe ser un número, en pesos.");
    else if (n < 0 || n > 99_999_999_999) errores.push("El valor de compra no es razonable. Revísalo.");
    else valorCompra = Math.round(n);
  }
  const compra = leerFecha(v.fecha_compra);
  if (compra.error) errores.push("La fecha de compra no es válida (usa día/mes/año).");
  else if (compra.valor && (compra.valor > hoy || compra.valor < "1990-01-01")) errores.push("La fecha de compra debe estar entre 1990 y hoy.");
  if (origen !== "comprado" && (valorCompra !== undefined || compra.valor)) errores.push("El valor y la fecha de compra solo aplican a animales «Comprado».");

  const crudoPeso = texto(v.peso_nacer_kg);
  let peso: number | undefined;
  if (crudoPeso) {
    const n = leerNumero(crudoPeso);
    if (n === null) errores.push("El peso al nacer debe ser un número, en kilos.");
    else if (n < 0.1 || n > 15) errores.push("El peso al nacer debe estar entre 0,1 y 15 kg.");
    else if (origen === "comprado") errores.push("El peso al nacer solo se conoce de los animales que nacieron en la finca.");
    else peso = n;
  }

  // Aptitud (hembras) y uso (machos)
  const crudaAptitud = normalizar(texto(v.aptitud));
  let vocacion: "leche" | "carne" | "doble" = ctx.aptitudDefecto ?? "leche";
  if (crudaAptitud) {
    if (["leche", "carne", "doble", "doble proposito"].includes(crudaAptitud)) vocacion = crudaAptitud === "doble proposito" ? "doble" : (crudaAptitud as typeof vocacion);
    else errores.push(`La aptitud «${texto(v.aptitud)}» no es válida (usa Leche, Carne o Doble).`);
  }
  const crudoUso = normalizar(texto(v.uso_macho));
  let usoMacho: "reproductor" | "carne" | undefined;
  if (crudoUso) {
    if (sexo === "hembra") errores.push("«Uso del macho» solo aplica a machos.");
    else if (crudoUso === "reproductor") usoMacho = "reproductor";
    else if (crudoUso === "carne") usoMacho = "carne";
    else if (crudoUso !== "por definir" && crudoUso !== "pordefinir") errores.push(`El uso «${texto(v.uso_macho)}» no es válido (usa Reproductor, Carne o Por definir).`);
  }

  // Padres
  const padreArete = texto(v.padre_arete);
  const madreArete = texto(v.madre_arete);
  if (padreArete && padreExterno) errores.push("Pon el padre por arete o por nombre, no los dos.");
  if (madreArete && madreExterna) errores.push("Pon la madre por arete o por nombre, no los dos.");
  if (padreArete) p.padreClave = normalizar(padreArete);
  if (madreArete) p.madreClave = normalizar(madreArete);
  if (padreArete && madreArete && p.padreClave === p.madreClave) errores.push("El padre y la madre no pueden ser el mismo animal.");

  if (errores.length === 0 && especie && sexo) {
    p.fila = {
      fila: cruda.fila,
      numero_arete: arete,
      especie,
      sexo,
      fecha_nacimiento_aprox: aprox === true,
      origen,
      vocacion: sexo === "macho" ? "carne" : vocacion,
      ...(nombre && { nombre }),
      ...(razaId && { raza_id: razaId }),
      ...(nac.valor && { fecha_nacimiento: nac.valor }),
      ...(padreArete && { padre_arete: padreArete }),
      ...(madreArete && { madre_arete: madreArete }),
      ...(padreExterno && { padre_externo: padreExterno }),
      ...(madreExterna && { madre_externa: madreExterna }),
      ...(usoMacho && { uso_macho: usoMacho }),
      ...(parto.valor && { fecha_ultimo_parto: parto.valor }),
      ...(partosTotal !== undefined && { partos_total: partosTotal }),
      ...(serv.valor && ctx.reproduccion && sexo === "hembra" && {
        fecha_servicio: serv.valor,
        tipo_servicio: tipoServicio ?? "monta_natural",
        ...(prenez === true && { prenez_confirmada: true }),
        ...(sementalArete && { semental_arete: sementalArete }),
        ...(sementalExterno && !sementalArete && { semental_externo: sementalExterno }),
      }),
      ...(p.ubicacion && { ubicacion_id: p.ubicacion.id }),
      ...(peso !== undefined && { peso_nacer_kg: peso }),
      ...(chip && { chip }),
      ...(color && { color }),
      ...(marcas && { marcas }),
      ...(valorCompra !== undefined && { valor_compra: valorCompra }),
      ...(compra.valor && { fecha_compra: compra.valor }),
      ...(notas && { notas }),
    };
  }
  return p;
}
