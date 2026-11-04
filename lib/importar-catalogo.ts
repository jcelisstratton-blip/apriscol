import { leerNumero } from "@/lib/numeros";
import { leerFecha, leerSiNo, normalizar, texto, type ErrorFila } from "@/lib/importar-animales";
import type { FilaHistoriaCruda, MuestraHistoria, ResumenHistoria, TipoCatalogo } from "@/lib/importar-historia";

/**
 * Reglas de los cargues de catálogos y bodega desde Excel: corrales y potreros, medicamentos y vacunas (con su conteo de apertura por lote) y alimento (con su
 * conteo de apertura en kg). Puro: no depende de Excel ni de la base. Espejo de lo que exigen las tablas y las pantallas de cada módulo (la base vuelve a exigirlo).
 * Un corral, un producto o un alimento que ya existe (por nombre) se reutiliza y no se modifica; el conteo de apertura de un lote que ya lo tiene se deja como está.
 */

export const MAX_FILAS_CATALOGO = 2000;
const FECHA_MINIMA = "2000-01-01";

export type ContextoCatalogo = {
  hoy: string;
  /** Nombres de los corrales y potreros que ya existen. */
  corrales: string[];
  productosVet: { nombre: string; presentacion: string | null; contenido_presentacion: number | null }[];
  alimentos: { nombre: string; rubro: string }[];
};

/** Lo que recibe `importar_catalogo` por fila (los números ya van en la unidad de la dosis o en kg). */
export type FilaCatalogo = { fila: number; nombre: string } & Record<string, string | number | boolean | undefined>;

export type ResultadoCatalogo = { filas: FilaCatalogo[]; errores: ErrorFila[]; resumen: ResumenHistoria; muestra: MuestraHistoria[] };

export const MAX_ERRORES_CATALOGO = 200;
const FILAS_DE_MUESTRA = 20;
const RUBROS_ALIMENTO = ["concentrado", "forraje", "sales_suplementos", "leche_maternizada"] as const;

const USOS: Record<string, string> = {
  general: "general", ordeno: "ordeno", ordenio: "ordeno", maternidad: "maternidad", crias: "crias", cria: "crias", cuarentena: "cuarentena",
  "alta produccion": "alta_produccion", altas: "alta_produccion", secas: "secas", seca: "secas", reproductoras: "reproductoras", reproduccion: "reproductoras",
  ceba: "ceba", engorde: "ceba", reemplazos: "reemplazos", reemplazo: "reemplazos",
};
const PISOS: Record<string, string> = {
  elevado: "elevado", emparrillado: "emparrillado", tierra: "tierra", cemento: "cemento", concreto: "cemento", pasto: "pasto", otro: "otro",
};
const TIPOS_VET: Record<string, string> = {
  vacuna: "vacuna", vacunas: "vacuna", desparasitante: "desparasitante", desparasitantes: "desparasitante", antiparasitario: "desparasitante",
  antibiotico: "antibiotico", antibioticos: "antibiotico", antiinflamatorio: "antiinflamatorio", antiinflamatorios: "antiinflamatorio",
  vitamina: "vitamina", vitaminas: "vitamina", otro: "otro", otros: "otro",
};
const RUBROS: Record<string, (typeof RUBROS_ALIMENTO)[number]> = {
  concentrado: "concentrado", concentrados: "concentrado", "alimento balanceado": "concentrado", balanceado: "concentrado",
  forraje: "forraje", forrajes: "forraje", heno: "forraje", pasto: "forraje", ensilaje: "forraje", silo: "forraje", paca: "forraje",
  "sales y suplementos": "sales_suplementos", "sales suplementos": "sales_suplementos", sal: "sales_suplementos", sales: "sales_suplementos", suplemento: "sales_suplementos",
  suplementos: "sales_suplementos", mineral: "sales_suplementos", minerales: "sales_suplementos", mineralizada: "sales_suplementos",
  "leche maternizada": "leche_maternizada", maternizada: "leche_maternizada", "sustituto lacteo": "leche_maternizada",
};

const clave = (v: unknown) => normalizar(texto(v as never)).replace(/[-_]/g, " ");
const redondear = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const es = (n: number) => String(redondear(n, 2)).replace(".", ",");
const fechaLarga = (iso: string) => iso.split("-").reverse().join("/");


function leerNombre(v: Record<string, unknown>, max: number, etiqueta: string, errores: string[]): string {
  const nombre = texto(v.nombre as never);
  if (!nombre) errores.push(`Falta el nombre ${etiqueta}.`);
  else if (nombre.length > max) errores.push(`El nombre es muy largo (máximo ${max} caracteres).`);
  return nombre;
}

function entero(v: unknown, min: number, max: number, nombre: string, errores: string[]): number | undefined {
  const t = texto(v as never);
  if (!t) return undefined;
  const n = leerNumero(t);
  if (n === null || !Number.isInteger(n) || n < min || n > max) {
    errores.push(`${nombre} debe ser un número entero entre ${min} y ${max}.`);
    return undefined;
  }
  return n;
}

export function validarCatalogo(tipo: TipoCatalogo, filasCrudas: FilaHistoriaCruda[], ctx: ContextoCatalogo): ResultadoCatalogo {
  const errores: ErrorFila[] = [];
  let totalErrores = 0;
  const agregar = (cruda: FilaHistoriaCruda, nombre: string, mensajes: string[]) => {
    totalErrores++;
    if (errores.length < MAX_ERRORES_CATALOGO) errores.push({ fila: cruda.fila, arete: nombre, mensajes });
  };
  const salida = (r: Omit<ResultadoCatalogo, "errores" | "resumen"> & { resumen: Omit<ResumenHistoria, "total_errores"> }): ResultadoCatalogo => {
    errores.sort((a, b) => a.fila - b.fila);
    return totalErrores > 0 ? { filas: [], errores, resumen: { ...r.resumen, total_errores: totalErrores }, muestra: [] } : { ...r, errores, resumen: { ...r.resumen, total_errores: 0 } };
  };

  if (tipo === "corrales") return corrales(filasCrudas, ctx, agregar, salida);
  if (tipo === "medicamentos") return medicamentos(filasCrudas, ctx, agregar, salida);
  return alimento(filasCrudas, ctx, agregar, salida);
}

type Agregar = (cruda: FilaHistoriaCruda, nombre: string, mensajes: string[]) => void;
type Salida = (r: { filas: FilaCatalogo[]; muestra: MuestraHistoria[]; resumen: Omit<ResumenHistoria, "total_errores"> }) => ResultadoCatalogo;

// ───────────────────────── Corrales y potreros ─────────────────────────
function corrales(filasCrudas: FilaHistoriaCruda[], ctx: ContextoCatalogo, agregar: Agregar, salida: Salida): ResultadoCatalogo {
  const existentes = new Set(ctx.corrales.map(normalizar));
  const vistos = new Map<string, number>();
  const filas: FilaCatalogo[] = [];
  let yaExisten = 0;
  let capacidadTotal = 0;
  for (const cruda of filasCrudas) {
    const v = cruda.valores;
    const m: string[] = [];
    const nombre = leerNombre(v, 80, "del corral o potrero", m);
    const k = normalizar(nombre);
    if (nombre && existentes.has(k)) {
      yaExisten++;
      continue; // ya está en la finca: se deja como está
    }
    if (nombre) {
      const previa = vistos.get(k);
      if (previa !== undefined) m.push(`El nombre «${nombre}» se repite (ya está en la fila ${previa}).`);
      else vistos.set(k, cruda.fila);
    }
    const capacidad = entero(v.capacidad, 1, 5000, "La capacidad", m);
    const t = clave(v.tipo);
    let tipoFila: "corral" | "potrero" = capacidad !== undefined ? "corral" : "potrero";
    if (t) {
      if (["corral", "corrales"].includes(t)) tipoFila = "corral";
      else if (["potrero", "potreros", "pradera", "lote de pasto"].includes(t)) tipoFila = "potrero";
      else m.push(`El tipo «${texto(v.tipo as never)}» no es válido (usa Corral o Potrero).`);
    }
    if (tipoFila === "corral" && capacidad === undefined && !m.some((x) => x.startsWith("La capacidad"))) m.push("Un corral necesita su capacidad (cuántos animales caben).");
    const u = clave(v.uso);
    let uso: string | undefined;
    if (u) {
      uso = USOS[u];
      if (!uso) m.push(`El uso «${texto(v.uso as never)}» no es válido (General, Ordeño, Maternidad, Crías, Cuarentena, Alta producción, Secas, Reproductoras, Ceba o Reemplazos).`);
    }
    const p = clave(v.piso);
    let piso: string | undefined;
    if (p) {
      piso = PISOS[p];
      if (!piso) m.push(`El piso «${texto(v.piso as never)}» no es válido (Elevado, Emparrillado, Tierra, Cemento, Pasto u Otro).`);
    }
    let area: number | undefined;
    if (texto(v.area_m2 as never)) {
      const n = leerNumero(texto(v.area_m2 as never));
      if (n === null || n <= 0) m.push("El área debe ser un número mayor que cero (m²).");
      else area = n;
    }
    const agua = leerSiNo(v.agua as never);
    if (agua === null) m.push("«Tiene agua» debe ser Sí o No.");
    const ocupacion = entero(v.dias_ocupacion_max, 1, 60, "Los días máximos de ocupación", m);
    const descanso = entero(v.dias_descanso_min, 1, 180, "Los días de descanso", m);
    const obs = texto(v.observaciones as never);
    if (obs.length > 500) m.push("Las observaciones son muy largas (máximo 500 caracteres).");

    if (m.length > 0) {
      agregar(cruda, nombre, m);
      continue;
    }
    capacidadTotal += capacidad ?? 0;
    filas.push({
      fila: cruda.fila,
      nombre,
      tipo: tipoFila,
      ...(uso && { uso }),
      ...(capacidad !== undefined && { capacidad }),
      ...(area !== undefined && { area_m2: area }),
      ...(piso && { piso }),
      // «Tiene agua» vacío es Sí (lo que hace la base); solo se manda cuando dicen que no.
      ...(agua === false && texto(v.agua as never) !== "" && { agua: false }),
      ...(ocupacion !== undefined && { dias_ocupacion_max: ocupacion }),
      ...(descanso !== undefined && { dias_descanso_min: descanso }),
      ...(obs && { observaciones: obs }),
    });
  }
  const muestra = filas.slice(0, FILAS_DE_MUESTRA).map((f) => ({
    fila: f.fila,
    numero_arete: f.nombre,
    fecha: "",
    detalle: [f.tipo === "potrero" ? "Potrero" : "Corral", f.capacidad ? `caben ${f.capacidad}` : null, f.area_m2 ? `${es(Number(f.area_m2))} m²` : null].filter(Boolean).join(" · "),
  }));
  return salida({ filas, muestra, resumen: { total: filas.length, animales: filas.length, desde: null, hasta: null, suma: capacidadTotal, nuevos: filas.length, ya_existen: yaExisten } });
}

// ───────────────────────── Medicamentos y vacunas ─────────────────────────
function medicamentos(filasCrudas: FilaHistoriaCruda[], ctx: ContextoCatalogo, agregar: Agregar, salida: Salida): ResultadoCatalogo {
  const catalogo = new Map(ctx.productosVet.map((p) => [normalizar(p.nombre), p]));
  /** Lo que el archivo dijo del producto en su primera fila (el catálogo del producto nuevo sale de ahí). */
  const primeras = new Map<string, { fila: number; presentacion?: string; contenido?: number; unidad?: string }>();
  const lotes = new Map<string, number>();
  const filas: FilaCatalogo[] = [];
  const productos = new Set<string>();
  const productosNuevos = new Set<string>();
  let vencidos = 0;

  for (const cruda of filasCrudas) {
    const v = cruda.valores;
    const m: string[] = [];
    const nombre = leerNombre(v, 120, "del producto", m);
    const k = normalizar(nombre);
    const existente = catalogo.get(k);

    // Catálogo del producto (solo cuenta si es nuevo)
    const t = clave(v.tipo);
    let tipo = "otro";
    if (t) {
      if (TIPOS_VET[t]) tipo = TIPOS_VET[t];
      else m.push(`El tipo «${texto(v.tipo as never)}» no es válido (Vacuna, Desparasitante, Antibiótico, Antiinflamatorio, Vitamina u Otro).`);
    }
    const unidad = texto(v.unidad_dosis as never);
    if (unidad.length > 20) m.push("La unidad de la dosis es muy larga (máximo 20 caracteres).");
    const presentacion = texto(v.presentacion as never);
    if (presentacion.length > 30) m.push("La presentación es muy larga (máximo 30 caracteres).");
    let contenido: number | undefined;
    if (texto(v.contenido_presentacion as never)) {
      const n = leerNumero(texto(v.contenido_presentacion as never));
      if (n === null || n <= 0 || n > 1_000_000) m.push("El contenido de la presentación debe ser un número mayor que cero.");
      else contenido = n;
    }
    if (!existente && Boolean(presentacion) !== (contenido !== undefined) && !m.some((x) => x.startsWith("El contenido"))) {
      m.push("La presentación y su contenido van juntos (por ejemplo «frasco» y 100): pon los dos o ninguno.");
    }
    const retiroLeche = entero(v.retiro_leche_dias, 0, 365, "Los días de retiro de leche", m);
    const retiroCarne = entero(v.retiro_carne_dias, 0, 365, "Los días de retiro de carne", m);
    const ica = texto(v.registro_ica as never);
    if (ica.length > 40) m.push("El registro ICA es muy largo (máximo 40 caracteres).");

    // Las filas de un mismo producto nuevo no pueden contradecirse en lo que cambia la cuenta de la cantidad.
    if (nombre && !existente) {
      const p = primeras.get(k);
      if (!p) primeras.set(k, { fila: cruda.fila, presentacion: presentacion || undefined, contenido, unidad: unidad || undefined });
      else {
        if (presentacion && p.presentacion && normalizar(presentacion) !== normalizar(p.presentacion)) m.push(`La presentación no coincide con la de la fila ${p.fila} (mismo producto).`);
        if (contenido !== undefined && p.contenido !== undefined && contenido !== p.contenido) m.push(`El contenido de la presentación no coincide con el de la fila ${p.fila} (mismo producto).`);
        if (unidad && p.unidad && normalizar(unidad) !== normalizar(p.unidad)) m.push(`La unidad de la dosis no coincide con la de la fila ${p.fila} (mismo producto).`);
      }
    }
    const base = existente ? undefined : primeras.get(k);
    // Cómo se cuenta: en la presentación (frascos) si el producto la tiene; si no, en la unidad de la dosis.
    const factor = existente ? (existente.presentacion && existente.contenido_presentacion ? existente.contenido_presentacion : 1) : (base?.contenido ?? contenido ?? 1);
    const presentacionDe = existente ? existente.presentacion : (base?.presentacion ?? presentacion) || null;

    // El conteo
    const crudaCantidad = texto(v.cantidad as never);
    let cantidad: number | undefined;
    if (!crudaCantidad) m.push("Falta la cantidad (lo que hay hoy; puede ser 0).");
    else {
      const n = leerNumero(crudaCantidad);
      if (n === null || n < 0 || n > 1_000_000) m.push("La cantidad debe ser un número entre 0 y 1.000.000.");
      else cantidad = n;
    }
    const minimo = texto(v.stock_minimo as never) ? leerNumero(texto(v.stock_minimo as never)) : undefined;
    if (minimo === null || (minimo !== undefined && (minimo < 0 || minimo > 100_000_000))) m.push("La existencia mínima debe ser un número (0 o más).");
    const lote = texto(v.lote as never);
    if (lote.length > 60) m.push("El lote es muy largo (máximo 60 caracteres).");
    const venc = leerFecha(v.vencimiento as never);
    if (texto(v.vencimiento as never) && (venc.error || !venc.valor)) m.push("El vencimiento no es válido (usa día/mes/año).");
    else if (venc.valor && (venc.valor < FECHA_MINIMA || venc.valor > "2099-12-31")) m.push("El vencimiento no es razonable. Revísalo.");
    const fecha = leerFecha(v.fecha as never);
    if (texto(v.fecha as never) && (fecha.error || !fecha.valor)) m.push("La fecha del conteo no es válida (usa día/mes/año).");
    else if (fecha.valor && (fecha.valor > ctx.hoy || fecha.valor < FECHA_MINIMA)) m.push("La fecha del conteo no puede ser futura.");

    if (nombre) {
      const llave = `${k}|${normalizar(lote)}`;
      const previa = lotes.get(llave);
      if (previa !== undefined) m.push(`Este lote ya está en la fila ${previa} (mismo producto${lote ? ` y lote «${lote}»` : ", sin lote"}): junta las cantidades en una sola fila.`);
      else lotes.set(llave, cruda.fila);
    }
    if (m.length > 0) {
      agregar(cruda, nombre, m);
      continue;
    }
    productos.add(k);
    if (!existente) productosNuevos.add(k);
    if (venc.valor && venc.valor < ctx.hoy && (cantidad ?? 0) > 0) vencidos++;
    const total = redondear((cantidad ?? 0) * factor);
    filas.push({
      fila: cruda.fila,
      nombre,
      cantidad: total,
      // Para mostrar: lo que escribió la persona y en qué presentación (no lo usa la base).
      cantidad_original: cantidad ?? 0,
      ...(lote && { lote }),
      ...(venc.valor && { vencimiento: venc.valor }),
      ...(fecha.valor && { fecha: fecha.valor }),
      ...(!existente && {
        tipo,
        ...((base?.unidad ?? unidad) && { unidad_dosis: base?.unidad ?? unidad }),
        ...(presentacionDe && factor > 1 && { presentacion: presentacionDe, contenido_presentacion: factor }),
        ...(presentacionDe && factor === 1 && contenido !== undefined && { presentacion: presentacionDe, contenido_presentacion: 1 }),
        ...(minimo !== undefined && minimo !== null && { stock_minimo: redondear(minimo * factor) }),
        ...(retiroLeche !== undefined && { retiro_leche_dias: retiroLeche }),
        ...(retiroCarne !== undefined && { retiro_carne_dias: retiroCarne }),
        ...(ica && { registro_ica: ica }),
      }),
      factor,
      ...(presentacionDe && { etiqueta_presentacion: presentacionDe }),
    });
  }
  const muestra: MuestraHistoria[] = filas.slice(0, FILAS_DE_MUESTRA).map((f) => ({
    fila: f.fila,
    numero_arete: f.nombre,
    fecha: "",
    detalle: [
      Number(f.factor) > 1 ? `${es(Number(f.cantidad_original))} ${f.etiqueta_presentacion ?? "unid."} = ${es(Number(f.cantidad))}` : es(Number(f.cantidad)),
      f.lote ? `lote ${f.lote}` : "sin lote",
      f.vencimiento ? `vence ${fechaLarga(String(f.vencimiento))}` : null,
    ].filter(Boolean).join(" · "),
  }));
  // Los datos de apoyo (`cantidad_original`, `factor`, `etiqueta_presentacion`) no viajan a la base: se quitan al guardar.
  return salida({
    filas,
    muestra,
    resumen: { total: filas.length, animales: productos.size, desde: null, hasta: null, suma: vencidos, nuevos: productosNuevos.size, ya_existen: productos.size - productosNuevos.size },
  });
}

/** Lo que de verdad recibe la base (sin los datos de apoyo para la vista previa). */
const DATOS_DE_APOYO = ["cantidad_original", "factor", "etiqueta_presentacion"];
export function paraGuardarCatalogo(filas: FilaCatalogo[]): FilaCatalogo[] {
  return filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !DATOS_DE_APOYO.includes(k))) as FilaCatalogo);
}

// ───────────────────────── Alimento ─────────────────────────
function alimento(filasCrudas: FilaHistoriaCruda[], ctx: ContextoCatalogo, agregar: Agregar, salida: Salida): ResultadoCatalogo {
  const catalogo = new Map(ctx.alimentos.map((a) => [normalizar(a.nombre), a]));
  const vistos = new Map<string, number>();
  const filas: FilaCatalogo[] = [];
  const nuevos = new Set<string>();
  let kg = 0;
  for (const cruda of filasCrudas) {
    const v = cruda.valores;
    const m: string[] = [];
    const nombre = leerNombre(v, 120, "del alimento", m);
    const k = normalizar(nombre);
    const existente = catalogo.get(k);
    if (nombre) {
      const previa = vistos.get(k);
      if (previa !== undefined) m.push(`El alimento «${nombre}» se repite (ya está en la fila ${previa}): se cuenta una sola vez.`);
      else vistos.set(k, cruda.fila);
    }
    if (existente && !(RUBROS_ALIMENTO as readonly string[]).includes(existente.rubro)) {
      m.push(`Ya existe un producto llamado «${nombre}» que no es un alimento: usa otro nombre.`);
    }
    const r = clave(v.rubro);
    let rubro: string | undefined;
    if (r) {
      rubro = RUBROS[r];
      if (!rubro) m.push(`El rubro «${texto(v.rubro as never)}» no es válido (Concentrado, Forraje, Sales y suplementos o Leche maternizada).`);
    } else if (!existente) {
      m.push("Falta el rubro (Concentrado, Forraje, Sales y suplementos o Leche maternizada): sirve para ordenar el alimento.");
    }
    const unidad = texto(v.unidad as never);
    if (unidad.length > 20) m.push("La unidad es muy larga (máximo 20 caracteres).");
    let kgUnidad: number | undefined;
    if (texto(v.kg_por_unidad as never)) {
      const n = leerNumero(texto(v.kg_por_unidad as never));
      if (n === null || n <= 0 || n > 100_000) m.push("Los kg por unidad deben ser un número mayor que cero.");
      else kgUnidad = n;
    }
    let cantidad: number | undefined;
    const c = texto(v.cantidad as never);
    if (!c) m.push("Faltan las existencias en kg (lo que hay hoy; puede ser 0).");
    else {
      const n = leerNumero(c);
      if (n === null || n < 0 || n > 100_000_000) m.push("Las existencias deben ser un número de kg (0 o más).");
      else cantidad = n;
    }
    const fecha = leerFecha(v.fecha as never);
    if (texto(v.fecha as never) && (fecha.error || !fecha.valor)) m.push("La fecha del conteo no es válida (usa día/mes/año).");
    else if (fecha.valor && (fecha.valor > ctx.hoy || fecha.valor < FECHA_MINIMA)) m.push("La fecha del conteo no puede ser futura.");
    if (m.length > 0) {
      agregar(cruda, nombre, m);
      continue;
    }
    if (!existente) nuevos.add(k);
    kg += cantidad ?? 0;
    filas.push({
      fila: cruda.fila,
      nombre,
      cantidad: redondear(cantidad ?? 0, 3),
      ...(!existente && rubro && { rubro }),
      ...(!existente && unidad && { unidad }),
      ...(!existente && kgUnidad !== undefined && { kg_por_unidad: kgUnidad }),
      ...(fecha.valor && { fecha: fecha.valor }),
    });
  }
  const muestra = filas.slice(0, FILAS_DE_MUESTRA).map((f) => ({
    fila: f.fila,
    numero_arete: f.nombre,
    fecha: "",
    detalle: [`${es(Number(f.cantidad))} kg`, f.rubro ? String(f.rubro).replace(/_/g, " ") : "ya está en tus alimentos"].join(" · "),
  }));
  return salida({ filas, muestra, resumen: { total: filas.length, animales: filas.length, desde: null, hasta: null, suma: redondear(kg, 1), nuevos: nuevos.size, ya_existen: filas.length - nuevos.size } });
}
