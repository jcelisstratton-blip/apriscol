import { leerNumero } from "@/lib/numeros";
import { claveEncabezado, leerFecha, leerSiNo, normalizar, texto, type CeldaCruda, type ErrorFila } from "@/lib/importar-animales";
import type { ColumnaArchivo } from "@/lib/importar-mapeo";

/**
 * Cargue de historia desde Excel: pesajes, ordeños y sanidad (vacunas, desparasitaciones, tratamientos…) pasados de animales que ya están en el hato. Aquí vive todo lo que NO depende de Excel ni de la
 * base: qué columnas tiene cada cargue, cómo se reconocen y las reglas de cada fila (espejo de `guardarPeso`/`crearPesaje` y `guardarOrdeno`; la base
 * vuelve a exigirlas). Cada registro se amarra al animal por su número de arete.
 */

export type TipoHistoria = "pesajes" | "ordenos" | "sanidad";
export const TIPOS_HISTORIA: readonly TipoHistoria[] = ["pesajes", "ordenos", "sanidad"];
export const MAX_FILAS_HISTORIA = 5000;
/** La historia puede venir de años atrás (a diferencia del registro del día a día, que llega hasta un año): desde esta fecha. */
export const FECHA_MINIMA_HISTORIA = "2000-01-01";
/** Cuántos errores se muestran (si hay más, se cuentan): una columna mal emparejada daría miles de iguales. */
export const MAX_ERRORES_HISTORIA = 200;
const FILAS_DE_MUESTRA = 20;

export type CampoHistoria = { id: string; titulo: string; requerido: boolean; alias: string[] };

const ARETE: CampoHistoria = {
  id: "numero_arete",
  titulo: "Número de arete",
  requerido: true,
  alias: ["arete", "numero de arete", "n de arete", "no de arete", "nro arete", "n arete", "id", "id animal", "identificacion", "codigo", "chapeta", "caravana", "animal", "numero animal", "numero"],
};
const FECHA: CampoHistoria = { id: "fecha", titulo: "Fecha", requerido: true, alias: ["fecha", "dia", "fecha de pesaje", "fecha pesaje", "fecha de ordeno", "fecha ordeno", "f pesaje", "fecha peso", "fecha del dia"] };
const OBS: CampoHistoria = { id: "observaciones", titulo: "Observaciones", requerido: false, alias: ["observaciones", "observacion", "notas", "nota", "obs", "comentarios", "comentario"] };

export const CAMPOS_HISTORIA: Record<TipoHistoria, CampoHistoria[]> = {
  pesajes: [
    ARETE,
    FECHA,
    { id: "peso_kg", titulo: "Peso (kg)", requerido: true, alias: ["peso", "peso kg", "kg", "kilos", "peso en kg", "peso actual", "peso del animal", "pesaje"] },
    { id: "tipo", titulo: "Tipo de pesaje", requerido: false, alias: ["tipo de pesaje", "tipo pesaje", "tipo"] },
    { id: "condicion_corporal", titulo: "Condición corporal", requerido: false, alias: ["condicion corporal", "cc", "bcs", "condicion"] },
    OBS,
  ],
  sanidad: [
    ARETE,
    FECHA,
    { id: "tipo", titulo: "Tipo de evento", requerido: true, alias: ["tipo", "tipo de evento", "evento", "actividad", "labor", "tipo de sanidad", "tipo sanidad"] },
    { id: "producto_nombre", titulo: "Producto", requerido: false, alias: ["producto", "medicamento", "vacuna", "desparasitante", "biologico", "nombre del producto", "droga", "farmaco"] },
    { id: "dosis", titulo: "Dosis", requerido: false, alias: ["dosis", "cantidad aplicada", "dosis aplicada"] },
    { id: "unidad_dosis", titulo: "Unidad de la dosis", requerido: false, alias: ["unidad", "unidad dosis", "unidad de la dosis", "unidad de medida"] },
    { id: "via", titulo: "Vía de aplicación", requerido: false, alias: ["via", "via de aplicacion", "via de administracion", "aplicacion"] },
    { id: "lote_producto", titulo: "Lote del producto", requerido: false, alias: ["lote", "lote del producto", "n lote", "numero de lote"] },
    { id: "responsable", titulo: "Responsable", requerido: false, alias: ["responsable", "aplicado por", "quien aplico", "aplico", "veterinario", "operario"] },
    { id: "diagnostico", titulo: "Diagnóstico", requerido: false, alias: ["diagnostico", "enfermedad", "motivo del tratamiento", "dx"] },
    { id: "proxima_fecha", titulo: "Próxima fecha", requerido: false, alias: ["proxima fecha", "proxima", "proxima dosis", "refuerzo", "fecha refuerzo", "proxima aplicacion", "proximo refuerzo", "repetir"] },
    { id: "retiro_leche_dias", titulo: "Días de retiro de leche", requerido: false, alias: ["retiro leche", "dias retiro leche", "retiro de leche", "dias de retiro de leche", "retiro leche dias"] },
    { id: "retiro_carne_dias", titulo: "Días de retiro de carne", requerido: false, alias: ["retiro carne", "dias retiro carne", "retiro de carne", "dias de retiro de carne", "retiro carne dias"] },
    OBS,
  ],
  ordenos: [
    ARETE,
    FECHA,
    { id: "litros", titulo: "Litros", requerido: true, alias: ["litros", "leche", "lt", "lts", "l", "produccion", "litros ordenados", "litros de leche", "leche litros", "produccion de leche"] },
    { id: "jornada", titulo: "Jornada", requerido: false, alias: ["jornada", "turno", "ordeno", "ordeno turno", "momento"] },
    { id: "descartada", titulo: "Leche descartada", requerido: false, alias: ["descartada", "descarte", "leche descartada", "se descarto", "descartar"] },
    OBS,
  ],
};

export const TITULO_HISTORIA: Record<TipoHistoria, { corto: string; registro: string; modulo: "carne" | "leche" | "sanidad" }> = {
  pesajes: { corto: "pesajes", registro: "pesos", modulo: "carne" },
  ordenos: { corto: "ordeños", registro: "ordeños", modulo: "leche" },
  sanidad: { corto: "sanidad", registro: "eventos de sanidad", modulo: "sanidad" },
};

const indiceAlias = (tipo: TipoHistoria) => {
  const m = new Map<string, string>();
  for (const c of CAMPOS_HISTORIA[tipo]) {
    m.set(claveEncabezado(c.titulo), c.id);
    for (const a of c.alias) m.set(claveEncabezado(a), c.id);
  }
  return m;
};

/** Qué tan reconocible es un título como columna de este cargue (0 si no): sirve para encontrar la fila de títulos. */
export const puntajeTituloHistoria = (tipo: TipoHistoria, titulo: string) => {
  const clave = claveEncabezado(titulo);
  if (!clave) return 0;
  const m = indiceAlias(tipo);
  if (m.has(clave)) return 100;
  for (const alias of m.keys()) if (alias.length >= 4 && ` ${clave} `.includes(` ${alias} `)) return 60;
  return 0;
};

const proporcionFechas = (valores: string[]) => {
  const v = valores.map((x) => x.trim()).filter(Boolean);
  return v.length === 0 ? 0 : v.filter((x) => !leerFecha(x).error && /\d/.test(x)).length / v.length;
};

/** Propone un campo para cada columna: por título (exacto o contenido) y, para la fecha, por el contenido. Un campo no se propone dos veces. */
export function proponerMapeoHistoria(tipo: TipoHistoria, columnas: ColumnaArchivo[]): (string | null)[] {
  const m = indiceAlias(tipo);
  const candidatos = columnas.map((c) => {
    const clave = claveEncabezado(c.encabezado);
    if (m.has(clave)) return { id: m.get(clave)!, puntaje: 100 };
    let mejor: { id: string; puntaje: number } | null = null;
    for (const [alias, id] of m) {
      if (alias.length < 4 || !` ${clave} `.includes(` ${alias} `)) continue;
      const puntaje = 50 + Math.min(alias.length, 30);
      if (!mejor || puntaje > mejor.puntaje) mejor = { id, puntaje };
    }
    return mejor;
  });
  const resultado: (string | null)[] = columnas.map(() => null);
  const usados = new Set<string>();
  const orden = columnas.map((_, i) => i).sort((a, b) => (candidatos[b]?.puntaje ?? 0) - (candidatos[a]?.puntaje ?? 0) || a - b);
  for (const i of orden) {
    const c = candidatos[i];
    if (!c || usados.has(c.id)) continue;
    usados.add(c.id);
    resultado[i] = c.id;
  }
  if (!usados.has("fecha")) {
    const i = columnas.findIndex((c, j) => resultado[j] === null && proporcionFechas(c.valores) >= 0.8);
    if (i >= 0) resultado[i] = "fecha";
  }
  return resultado;
}

export function faltantesHistoria(tipo: TipoHistoria, mapeo: (string | null)[]): string[] {
  return CAMPOS_HISTORIA[tipo].filter((c) => c.requerido && !mapeo.includes(c.id)).map((c) => c.titulo);
}

// ───────────────────────── Validación ─────────────────────────
export type FilaHistoriaCruda = { fila: number; valores: Record<string, CeldaCruda> };

/** Lo que recibe `importar_historial` por registro. */
export type FilaHistoria = {
  fila: number;
  numero_arete: string;
  fecha: string;
  peso_kg?: number;
  /** Pesajes: control, destete o pre-beneficio. Sanidad: vacunación, desparasitación, tratamiento… */
  tipo?: string;
  producto_nombre?: string;
  dosis?: number;
  unidad_dosis?: string;
  via?: string;
  lote_producto?: string;
  responsable?: string;
  diagnostico?: string;
  proxima_fecha?: string;
  retiro_leche_dias?: number;
  retiro_carne_dias?: number;
  condicion_corporal?: number;
  litros?: number;
  jornada?: "manana" | "tarde" | "noche" | "unico";
  descartada?: boolean;
  observaciones?: string;
};

export type AnimalHato = { numero_arete: string; sexo: "hembra" | "macho" };
export type ResumenHistoria = {
  total: number;
  animales: number;
  desde: string | null;
  hasta: string | null;
  /** Litros sumados (ordeños) o peso promedio (pesajes). */
  suma: number;
  /** Cuántos errores hay en total (se muestran hasta `MAX_ERRORES_HISTORIA`). */
  total_errores: number;
};
export type MuestraHistoria = { fila: number; numero_arete: string; fecha: string; detalle: string };
export type ResultadoHistoria = { filas: FilaHistoria[]; errores: ErrorFila[]; resumen: ResumenHistoria; muestra: MuestraHistoria[] };

const JORNADAS: Record<string, FilaHistoria["jornada"]> = {
  manana: "manana", "la manana": "manana", am: "manana", m: "manana", "1": "manana", mañana: "manana",
  tarde: "tarde", pm: "tarde", t: "tarde", "2": "tarde",
  noche: "noche", n: "noche", "3": "noche",
  unico: "unico", unica: "unico", dia: "unico", total: "unico", diario: "unico", "un solo ordeno": "unico",
};
const TIPOS_SANIDAD: Record<string, string> = {
  vacunacion: "vacunacion", vacuna: "vacunacion", vacunas: "vacunacion", vacunado: "vacunacion", vacunada: "vacunacion",
  desparasitacion: "desparasitacion", desparasitada: "desparasitacion", desparasitado: "desparasitacion", desparasitante: "desparasitacion", antiparasitario: "desparasitacion", purga: "desparasitacion", purgado: "desparasitacion", vermifugo: "desparasitacion",
  tratamiento: "tratamiento", tratamientos: "tratamiento", medicamento: "tratamiento", antibiotico: "tratamiento", curacion: "tratamiento", tto: "tratamiento", enfermedad: "tratamiento",
  cirugia: "cirugia", operacion: "cirugia",
  podologia: "podologia", pezunas: "podologia", "recorte de pezunas": "podologia", recorte: "podologia",
  pediluvio: "pediluvio", otro: "otro", otros: "otro", otra: "otro",
};
const ETIQUETA_SANIDAD: Record<string, string> = { vacunacion: "Vacunación", desparasitacion: "Desparasitación", tratamiento: "Tratamiento", cirugia: "Cirugía", podologia: "Podología", pediluvio: "Pediluvio", otro: "Otro" };
const VIAS: Record<string, string> = {
  oral: "oral", vo: "oral", "via oral": "oral",
  subcutanea: "subcutanea", subcutaneo: "subcutanea", sc: "subcutanea", "sub cutanea": "subcutanea", sq: "subcutanea",
  intramuscular: "intramuscular", im: "intramuscular",
  intravenosa: "intravenosa", iv: "intravenosa", intravenoso: "intravenosa",
  topica: "topica", topico: "topica",
  intramamaria: "intramamaria", otra: "otra", otro: "otra",
};
const TIPOS_PESAJE: Record<string, FilaHistoria["tipo"]> = {
  control: "control", seguimiento: "control", rutina: "control",
  destete: "destete", "al destete": "destete",
  "pre beneficio": "pre_beneficio", prebeneficio: "pre_beneficio", "pre_beneficio": "pre_beneficio", sacrificio: "pre_beneficio", venta: "pre_beneficio", "antes del beneficio": "pre_beneficio",
};
const CONDICIONES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function validarHistoria(tipo: TipoHistoria, filasCrudas: FilaHistoriaCruda[], ctx: { animales: AnimalHato[]; hoy: string }): ResultadoHistoria {
  const hato = new Map(ctx.animales.map((a) => [normalizar(a.numero_arete), a]));
  const errores: ErrorFila[] = [];
  const filas: FilaHistoria[] = [];
  const vistos = new Map<string, number>();
  /** Un arete que no sirve se reporta una sola vez (con cuántas filas toca), no una por fila. */
  const arete: Map<string, { fila: number; n: number; motivo: string; texto: string }> = new Map();
  let totalErrores = 0;
  const agregar = (e: ErrorFila) => {
    totalErrores++;
    if (errores.length < MAX_ERRORES_HISTORIA) errores.push(e);
  };

  for (const cruda of filasCrudas) {
    const v = cruda.valores;
    const m: string[] = [];
    const clave = normalizar(texto(v.numero_arete));
    const textoArete = texto(v.numero_arete);
    if (!textoArete) m.push("Falta el número de arete.");
    else {
      const a = hato.get(clave);
      if (!a || (tipo === "ordenos" && a.sexo !== "hembra")) {
        const motivo = !a ? "no está en tu hato." : "es un macho: los ordeños se registran sobre hembras.";
        const previo = arete.get(clave);
        if (previo) previo.n++;
        else arete.set(clave, { fila: cruda.fila, n: 1, motivo, texto: textoArete });
        continue;
      }
    }

    const fecha = leerFecha(v.fecha);
    if (!texto(v.fecha)) m.push("Falta la fecha.");
    else if (fecha.error || !fecha.valor) m.push("La fecha no es válida (usa día/mes/año, por ejemplo 15/03/2025).");
    else if (fecha.valor > ctx.hoy) m.push("La fecha no puede ser futura.");
    else if (fecha.valor < FECHA_MINIMA_HISTORIA) m.push("La fecha es demasiado antigua (desde el año 2000).");

    const f: FilaHistoria = { fila: cruda.fila, numero_arete: textoArete, fecha: fecha.valor ?? "" };
    const obs = texto(v.observaciones);
    if (obs.length > 1000) m.push("Las observaciones son muy largas (máximo 1000 caracteres).");
    else if (obs) f.observaciones = obs;

    if (tipo === "pesajes") {
      const crudo = texto(v.peso_kg);
      const n = crudo ? leerNumero(crudo) : null;
      if (!crudo) m.push("Falta el peso.");
      else if (n === null) m.push("El peso debe ser un número, en kilos.");
      else if (n <= 0) m.push("El peso debe ser mayor que cero.");
      else if (n > 250) m.push("El peso no puede pasar de 250 kg: revisa si está en kilos.");
      else f.peso_kg = Math.round(n * 10) / 10;
      const t = normalizar(texto(v.tipo)).replace(/[-_]/g, " ");
      if (t) {
        const tp = TIPOS_PESAJE[t];
        if (tp) f.tipo = tp;
        else m.push(`El tipo de pesaje «${texto(v.tipo)}» no es válido (usa Control, Destete o Pre-beneficio).`);
      }
      const cc = texto(v.condicion_corporal);
      if (cc) {
        const c = leerNumero(cc);
        if (c === null || !CONDICIONES.includes(c)) m.push("La condición corporal va de 1 a 5, de medio en medio.");
        else f.condicion_corporal = c;
      }
    } else if (tipo === "sanidad") {
      const t = normalizar(texto(v.tipo)).replace(/[-_]/g, " ");
      if (!t) m.push("Falta el tipo de evento (Vacunación, Desparasitación, Tratamiento…).");
      else if (!TIPOS_SANIDAD[t]) m.push(`El tipo de evento «${texto(v.tipo)}» no es válido (usa Vacunación, Desparasitación, Tratamiento, Cirugía, Podología, Pediluvio u Otro).`);
      else f.tipo = TIPOS_SANIDAD[t];
      const largoMax = (campo: string, max: number, nombre: string, destino: "producto_nombre" | "lote_producto" | "responsable" | "diagnostico" | "unidad_dosis") => {
        const x = texto(v[campo]);
        if (x.length > max) m.push(`${nombre} es muy largo (máximo ${max} caracteres).`);
        else if (x) f[destino] = x;
      };
      largoMax("producto_nombre", 120, "El producto", "producto_nombre");
      largoMax("lote_producto", 60, "El lote", "lote_producto");
      largoMax("responsable", 80, "El responsable", "responsable");
      largoMax("diagnostico", 200, "El diagnóstico", "diagnostico");
      largoMax("unidad_dosis", 20, "La unidad de la dosis", "unidad_dosis");
      const d = texto(v.dosis);
      if (d) {
        const n = leerNumero(d);
        if (n === null || n <= 0) m.push("La dosis debe ser un número mayor que cero.");
        else f.dosis = n;
      }
      const vi = normalizar(texto(v.via)).replace(/[-_]/g, " ");
      if (vi) {
        if (VIAS[vi]) f.via = VIAS[vi];
        else m.push(`La vía «${texto(v.via)}» no es válida (usa Oral, Subcutánea, Intramuscular, Intravenosa, Tópica, Intramamaria u Otra).`);
      }
      const pf = leerFecha(v.proxima_fecha);
      if (texto(v.proxima_fecha)) {
        if (pf.error || !pf.valor) m.push("La próxima fecha no es válida (usa día/mes/año).");
        else if (fecha.valor && pf.valor <= fecha.valor) m.push("La próxima fecha debe ser posterior a la fecha del evento.");
        else f.proxima_fecha = pf.valor;
      }
      for (const [campo, nombre] of [["retiro_leche_dias", "Los días de retiro de leche"], ["retiro_carne_dias", "Los días de retiro de carne"]] as const) {
        const x = texto(v[campo]);
        if (!x) continue;
        const n = leerNumero(x);
        if (n === null || !Number.isInteger(n) || n < 0 || n > 365) m.push(`${nombre} deben ser un número entero de 0 a 365.`);
        else if (n > 0) f[campo] = n;
      }
    } else {
      const crudo = texto(v.litros);
      const n = crudo ? leerNumero(crudo) : null;
      if (!crudo) m.push("Faltan los litros.");
      else if (n === null) m.push("Los litros deben ser un número.");
      else if (n < 0) m.push("Los litros no pueden ser negativos.");
      else if (n > 15) m.push("Más de 15 litros en un ordeño no es posible: revisa el dato (¿es el total de varios animales?).");
      else f.litros = Math.round(n * 100) / 100;
      const j = normalizar(texto(v.jornada)).replace(/[-_]/g, " ");
      if (j) {
        const jj = JORNADAS[j];
        if (jj) f.jornada = jj;
        else m.push(`La jornada «${texto(v.jornada)}» no es válida (usa Mañana, Tarde, Noche o Único).`);
      }
      const d = leerSiNo(v.descartada);
      if (d === null) m.push("«Leche descartada» debe ser Sí o No.");
      else if (d) f.descartada = true;
    }

    if (m.length === 0 && f.fecha) {
      const llave = `${clave}|${f.fecha}${tipo === "ordenos" ? `|${f.jornada ?? "unico"}` : ""}${tipo === "sanidad" ? `|${f.tipo}|${normalizar(f.producto_nombre ?? "")}` : ""}`;
      const previa = vistos.get(llave);
      if (previa !== undefined) m.push(`Este ${tipo === "pesajes" ? "peso" : tipo === "ordenos" ? "ordeño" : "evento"} se repite (ya está en la fila ${previa}).`);
      else vistos.set(llave, cruda.fila);
    }
    if (m.length > 0) agregar({ fila: cruda.fila, arete: textoArete, mensajes: m });
    else filas.push(f);
  }

  for (const [, a] of arete) {
    agregar({ fila: a.fila, arete: a.texto, mensajes: [`El arete «${a.texto}» ${a.motivo}${a.n > 1 ? ` Aparece en ${a.n} filas.` : ""}`] });
  }
  errores.sort((a, b) => a.fila - b.fila);

  const fechas = filas.map((f) => f.fecha).sort();
  // Lo que se resume junto a los animales: litros (ordeños), peso promedio (pesajes) o cuántos eventos distintos salen (sanidad: las filas iguales son uno solo).
  const suma =
    tipo === "ordenos"
      ? filas.reduce((s, f) => s + (f.litros ?? 0), 0)
      : tipo === "sanidad"
        ? new Set(filas.map((f) => [f.fecha, f.tipo, f.producto_nombre, f.dosis, f.unidad_dosis, f.via, f.lote_producto, f.responsable, f.diagnostico, f.observaciones, f.proxima_fecha, f.retiro_leche_dias, f.retiro_carne_dias].join("|"))).size
        : filas.length
          ? filas.reduce((s, f) => s + (f.peso_kg ?? 0), 0) / filas.length
          : 0;
  const resumen: ResumenHistoria = {
    total: filas.length,
    animales: new Set(filas.map((f) => normalizar(f.numero_arete))).size,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    suma: Math.round(suma * 100) / 100,
    total_errores: totalErrores,
  };
  const muestra: MuestraHistoria[] = filas.slice(0, FILAS_DE_MUESTRA).map((f) => ({
    fila: f.fila,
    numero_arete: f.numero_arete,
    fecha: f.fecha,
    detalle:
      tipo === "sanidad"
        ? [ETIQUETA_SANIDAD[f.tipo ?? "otro"], f.producto_nombre ?? null, f.dosis ? `${String(f.dosis).replace(".", ",")}${f.unidad_dosis ? ` ${f.unidad_dosis}` : ""}` : null, f.proxima_fecha ? `Próxima ${f.proxima_fecha.split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ")
        : tipo === "pesajes"
          ? [`${String(f.peso_kg).replace(".", ",")} kg`, f.tipo === "destete" ? "Destete" : f.tipo === "pre_beneficio" ? "Pre-beneficio" : null, f.condicion_corporal ? `CC ${String(f.condicion_corporal).replace(".", ",")}` : null].filter(Boolean).join(" · ")
        : [`${String(f.litros).replace(".", ",")} L`, f.jornada && f.jornada !== "unico" ? f.jornada.charAt(0).toUpperCase() + f.jornada.slice(1).replace("manana", "mañana") : null, f.descartada ? "Descartada" : null].filter(Boolean).join(" · "),
  }));
  return { filas: totalErrores > 0 ? [] : filas, errores, resumen, muestra: totalErrores > 0 ? [] : muestra };
}
