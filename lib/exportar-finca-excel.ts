import ExcelJS from "exceljs";
import { COLOR, estiloEncabezado, relleno } from "@/lib/excel-estilo";
import type { Writable } from "node:stream";
import { COLUMNAS, type ColumnaId } from "@/lib/importar-animales";
import {
  ARCHIVO_POR_COLUMNA,
  BUSQUEDA_POR_COLUMNA,
  COLUMNAS_OCULTAS,
  DIAS_ENLACE_ARCHIVO,
  HOJAS,
  aCelda,
  etiquetaColumna,
  humanizarOpcion,
  nombreHoja,
  type BusquedaId,
  type Hoja,
  type ValorCelda,
} from "@/lib/exportar-finca";

type Fila = Record<string, unknown>;
type Respuesta = { data: Fila[] | null; count?: number | null; error: { message: string } | null };
type Consulta = PromiseLike<Respuesta> & {
  eq(columna: string, valor: string): Consulta;
  order(columna: string): Consulta;
  range(desde: number, hasta: number): Consulta;
};
/** Lo mínimo que se usa del cliente de Supabase (así se puede probar con una base de mentira en memoria). */
export type ClienteExportar = {
  from(tabla: string): { select(columnas: string, opciones?: { count: "exact"; head: true }): Consulta };
  storage: {
    from(bucket: string): {
      createSignedUrls(rutas: string[], segundos: number): Promise<{ data: { path: string | null; signedUrl: string }[] | null; error: { message: string } | null }>;
    };
  };
};

const PAGINA = 1000;

// ───────────────────────── Lectura de la base ─────────────────────────
async function* paginas(c: ClienteExportar, tabla: string, fincaId: string | null, orden: string): AsyncGenerator<Fila[]> {
  for (let desde = 0; ; desde += PAGINA) {
    let q = c.from(tabla).select("*");
    if (fincaId) q = q.eq("finca_id", fincaId);
    const { data, error } = await q.order(orden).range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    const filas = data ?? [];
    if (filas.length > 0) yield filas;
    if (filas.length < PAGINA) return;
  }
}

async function todas(c: ClienteExportar, tabla: string, fincaId: string | null, orden = "id"): Promise<Fila[]> {
  const salida: Fila[] = [];
  for await (const p of paginas(c, tabla, fincaId, orden)) salida.push(...p);
  return salida;
}

async function contar(c: ClienteExportar, tabla: string, fincaId: string): Promise<number | null> {
  const { count, error } = await c.from(tabla).select("*", { count: "exact", head: true }).eq("finca_id", fincaId);
  return error ? null : (count ?? 0);
}

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const FUENTES: Record<BusquedaId, { tabla: string; global?: boolean; etiqueta: (f: Fila) => string }> = {
  animales: { tabla: "animales", etiqueta: (f) => texto(f.numero_arete) },
  ubicaciones: { tabla: "ubicaciones", etiqueta: (f) => texto(f.nombre) },
  lotes: { tabla: "lotes", etiqueta: (f) => texto(f.nombre) },
  lotes_ceba: { tabla: "lotes_ceba", etiqueta: (f) => texto(f.nombre) },
  terceros: { tabla: "finca_terceros", etiqueta: (f) => texto(f.nombre) },
  productos: { tabla: "finca_productos", etiqueta: (f) => texto(f.nombre) },
  veterinarios: { tabla: "productos_veterinarios", etiqueta: (f) => texto(f.nombre) },
  personal: { tabla: "personal", etiqueta: (f) => texto(f.nombre) },
  ferias: { tabla: "ferias", etiqueta: (f) => texto(f.nombre) },
  empadronamientos: { tabla: "empadronamientos", etiqueta: (f) => texto(f.nombre) },
  eventos: { tabla: "eventos_sanitarios", etiqueta: (f) => `${texto(f.fecha).split("-").reverse().join("/")} · ${humanizarOpcion(texto(f.tipo))}` },
  programas: { tabla: "programas_sanitarios", etiqueta: (f) => `${texto(f.fecha_programada).split("-").reverse().join("/")} · ${humanizarOpcion(texto(f.tipo))}` },
  razas: { tabla: "razas", global: true, etiqueta: (f) => texto(f.nombre) },
};

// ───────────────────────── Escritura ─────────────────────────

function encabezado(hoja: ExcelJS.Worksheet, titulos: string[]) {
  const fila = hoja.addRow(titulos);
  fila.height = 30;
  fila.eachCell((celda) => {
    estiloEncabezado(celda);
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  fila.commit();
}

const anchoDe = (titulo: string) => Math.min(40, Math.max(12, titulo.length + 3));

function escribirCelda(fila: ExcelJS.Row, i: number, v: ValorCelda) {
  const celda = fila.getCell(i + 1);
  celda.value = v.valor;
  if (v.formato) celda.numFmt = v.formato;
}

function enlace(fila: ExcelJS.Row, i: number, url: string | undefined) {
  const celda = fila.getCell(i + 1);
  if (!url) {
    celda.value = "No disponible";
    return;
  }
  celda.value = { text: "Abrir", hyperlink: url };
  celda.font = { color: { argb: "FF1D5FA8" }, underline: true };
}

/** Enlaces firmados de una página de filas (una semana), por ruta. */
async function enlacesDe(c: ClienteExportar, bucket: string, rutas: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicas = [...new Set(rutas)];
  for (let i = 0; i < unicas.length; i += 100) {
    const { data } = await c.storage.from(bucket).createSignedUrls(unicas.slice(i, i + 100), DIAS_ENLACE_ARCHIVO * 24 * 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl);
  }
  return mapa;
}

type ColumnaHoja = { clave: string; titulo: string; busqueda?: BusquedaId; bucket?: string };

function columnasDe(hoja: Hoja, ejemplo: Fila): ColumnaHoja[] {
  const salida: ColumnaHoja[] = [];
  for (const clave of Object.keys(ejemplo)) {
    if (COLUMNAS_OCULTAS.has(clave) || hoja.ocultar?.includes(clave)) continue;
    const bucket = ARCHIVO_POR_COLUMNA[`${hoja.tabla}.${clave}`];
    if (bucket) {
      salida.push({ clave, titulo: etiquetaColumna(clave), bucket });
      continue;
    }
    if (clave === "producto_id") {
      if (hoja.producto) salida.push({ clave, titulo: "Producto", busqueda: hoja.producto });
      continue;
    }
    const b = BUSQUEDA_POR_COLUMNA[clave];
    if (b) {
      salida.push({ clave, titulo: b.etiqueta, busqueda: b.busqueda });
      continue;
    }
    if (clave.endsWith("_id") || clave.endsWith("_path")) continue;
    salida.push({ clave, titulo: etiquetaColumna(clave) });
  }
  return salida;
}

export type ResultadoExportacion = { hojas: { hoja: string; filas: number }[]; errores: string[] };

/**
 * Escribe en `salida` el Excel con todos los datos de la finca, hoja por hoja y sin tener todo en memoria (el libro se va enviando).
 * Corre con la sesión de quien exporta: lo que la base no le deja ver no sale. Una hoja que falla no tumba el archivo: queda anotada en «Avisos».
 */
export async function escribirExportacion({
  cliente,
  finca,
  salida,
  ahora = new Date(),
  generadoPor,
}: {
  cliente: ClienteExportar;
  finca: { id: string; nombre: string };
  salida: Writable;
  ahora?: Date;
  generadoPor?: string;
}): Promise<ResultadoExportacion> {
  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: salida, useStyles: true, useSharedStrings: false });
  libro.creator = "Apriscol";
  const errores: string[] = [];
  const escritas: { hoja: string; filas: number }[] = [];

  // Búsquedas (id → nombre o arete), cada una se trae una sola vez y solo si alguna hoja la necesita.
  const cache = new Map<BusquedaId, Promise<Map<string, string>>>();
  const buscar = (b: BusquedaId) => {
    let p = cache.get(b);
    if (!p) {
      const f = FUENTES[b];
      p = todas(cliente, f.tabla, f.global ? null : finca.id).then((filas) => new Map(filas.map((r) => [texto(r.id), f.etiqueta(r)])));
      cache.set(b, p);
    }
    return p;
  };

  // Cuántos registros hay en cada tabla (para el resumen y para no crear hojas vacías).
  const tablas = ["animales", ...HOJAS.map((h) => h.tabla)];
  const conteos = new Map<string, number | null>(await Promise.all(tablas.map(async (t) => [t, await contar(cliente, t, finca.id)] as const)));

  // ── Resumen (primera hoja)
  {
    const hoja = libro.addWorksheet("Resumen");
    hoja.columns = [{ width: 34 }, { width: 16 }, { width: 70 }];
    const bogota = new Date(ahora.getTime() - 5 * 3600 * 1000);
    const dos = (n: number) => String(n).padStart(2, "0");
    const cuando = `${dos(bogota.getUTCDate())}/${dos(bogota.getUTCMonth() + 1)}/${bogota.getUTCFullYear()} ${dos(bogota.getUTCHours())}:${dos(bogota.getUTCMinutes())}`;
    const titulo = hoja.addRow([`Datos de la finca · ${finca.nombre}`]);
    titulo.getCell(1).font = { bold: true, size: 15, color: { argb: COLOR.musgo } };
    titulo.commit();
    for (const [a, b] of [
      ["Exportado el", cuando],
      ["Exportado por", generadoPor ?? ""],
    ]) {
      const f = hoja.addRow([a, b]);
      f.getCell(1).font = { bold: true };
      f.commit();
    }
    hoja.addRow([]).commit();
    for (const nota of [
      "La hoja «Animales» tiene el mismo formato de la plantilla de cargue de Apriscol: sirve para volver a subir el hato.",
      `Los enlaces de las columnas «Documento» y «Foto» funcionan ${DIAS_ENLACE_ARCHIVO} días: descarga los archivos antes de que venzan.`,
      "Cada animal se identifica por su número de arete; los corrales, lotes, proveedores y demás por su nombre.",
    ]) {
      const f = hoja.addRow([nota]);
      hoja.mergeCells(f.number, 1, f.number, 3);
      f.getCell(1).alignment = { wrapText: true, vertical: "top" };
      f.height = 30;
      f.commit();
    }
    hoja.addRow([]).commit();
    const enc = hoja.addRow(["Hoja", "Registros", "Nota"]);
    enc.eachCell((c) => {
      estiloEncabezado(c);
    });
    enc.commit();
    const lista: [string, number | null][] = [["Animales", conteos.get("animales") ?? null], ...HOJAS.map((h) => [h.hoja, conteos.get(h.tabla) ?? null] as [string, number | null])];
    lista.forEach(([nombre, n], i) => {
      if (n === 0) return;
      const f = hoja.addRow([nombre, n ?? "", n === null ? "No se pudo contar: revisa la hoja «Avisos» si existe." : ""]);
      if (i % 2 === 0) f.eachCell((c) => (c.fill = relleno(COLOR.lana)));
      f.commit();
    });
    await hoja.commit();
  }

  // ── Animales (mismo formato que la plantilla de cargue)
  if ((conteos.get("animales") ?? 0) > 0) {
    try {
      escritas.push(await escribirAnimales(libro, cliente, finca.id, buscar));
    } catch (e) {
      errores.push(`Animales: ${e instanceof Error ? e.message : "no se pudo exportar"}`);
    }
  }

  // ── El resto de hojas
  for (const h of HOJAS) {
    if ((conteos.get(h.tabla) ?? 1) === 0) continue;
    try {
      const n = await escribirHoja(libro, cliente, finca.id, h, buscar);
      if (n !== null) escritas.push({ hoja: h.hoja, filas: n });
    } catch (e) {
      errores.push(`${h.hoja}: ${e instanceof Error ? e.message : "no se pudo exportar"}`);
    }
  }

  if (errores.length > 0) {
    const hoja = libro.addWorksheet("Avisos");
    hoja.columns = [{ width: 100 }];
    const f = hoja.addRow(["Estas hojas no se pudieron exportar completas. Vuelve a intentarlo; si sigue igual, escríbenos."]);
    f.getCell(1).font = { bold: true };
    f.commit();
    for (const e of errores) hoja.addRow([e]).commit();
    await hoja.commit();
  }
  await libro.commit();
  return { hojas: escritas, errores };
}

async function escribirHoja(libro: ExcelJS.stream.xlsx.WorkbookWriter, cliente: ClienteExportar, fincaId: string, h: Hoja, buscar: (b: BusquedaId) => Promise<Map<string, string>>): Promise<number | null> {
  let hoja: ExcelJS.Worksheet | null = null;
  let columnas: ColumnaHoja[] = [];
  let total = 0;
  const busquedas = new Map<BusquedaId, Map<string, string>>();
  for await (const pagina of paginas(cliente, h.tabla, fincaId, h.orden ?? "id")) {
    if (!hoja) {
      columnas = columnasDe(h, pagina[0]);
      if (columnas.length === 0) return null;
      for (const c of columnas) if (c.busqueda && !busquedas.has(c.busqueda)) busquedas.set(c.busqueda, await buscar(c.busqueda));
      hoja = libro.addWorksheet(nombreHoja(h.hoja), { views: [{ state: "frozen", ySplit: 1 }] });
      hoja.columns = columnas.map((c) => ({ width: anchoDe(c.titulo) }));
      encabezado(hoja, columnas.map((c) => c.titulo));
    }
    // Los enlaces de archivos de esta página, de un solo golpe por bucket.
    const enlaces = new Map<string, Map<string, string>>();
    for (const c of columnas) {
      if (!c.bucket) continue;
      const rutas = pagina.map((f) => f[c.clave]).filter((r): r is string => typeof r === "string" && r !== "");
      enlaces.set(c.clave, rutas.length > 0 ? await enlacesDe(cliente, c.bucket, rutas) : new Map());
    }
    for (const fila of pagina) {
      const r = hoja.addRow([]);
      columnas.forEach((c, i) => {
        const valor = fila[c.clave];
        if (c.bucket) {
          if (typeof valor === "string" && valor !== "") enlace(r, i, enlaces.get(c.clave)?.get(valor));
        } else if (c.busqueda) {
          escribirCelda(r, i, { valor: valor ? (busquedas.get(c.busqueda)?.get(texto(valor)) ?? null) : null });
        } else {
          escribirCelda(r, i, aCelda(c.clave, valor));
        }
      });
      r.commit();
      total++;
    }
  }
  if (!hoja) return null;
  await hoja.commit();
  return total;
}

// ───────────────────────── Animales, en el formato de la plantilla ─────────────────────────
const TIPO_SERVICIO: Record<string, string> = { monta_natural: "Monta natural", inseminacion: "Inseminación", transferencia_embrionaria: "Transferencia de embrión" };
const mayor = (a: string | undefined, b: string | undefined) => (a && b ? (a > b ? a : b) : (a ?? b));

async function escribirAnimales(
  libro: ExcelJS.stream.xlsx.WorkbookWriter,
  cliente: ClienteExportar,
  fincaId: string,
  buscar: (b: BusquedaId) => Promise<Map<string, string>>,
): Promise<{ hoja: string; filas: number }> {
  const [animales, servicios, diagnosticos, partos, lactancias, movimientos, razas, ubicaciones, lotes] = await Promise.all([
    todas(cliente, "animales", fincaId),
    todas(cliente, "servicios", fincaId),
    todas(cliente, "diagnosticos_gestacion", fincaId),
    todas(cliente, "partos", fincaId),
    todas(cliente, "lactancias", fincaId),
    todas(cliente, "movimientos_animales", fincaId, "desde"),
    buscar("razas"),
    buscar("ubicaciones"),
    buscar("lotes"),
  ]);
  const arete = new Map(animales.map((a) => [texto(a.id), texto(a.numero_arete)]));
  const por = <T extends Fila>(filas: T[], campo: string) => {
    const m = new Map<string, T[]>();
    for (const f of filas) {
      const k = texto(f[campo]);
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return m;
  };
  const serviciosDe = por(servicios, "hembra_id");
  const diagnosticosDe = por(diagnosticos, "hembra_id");
  const partosDe = por(partos, "madre_id");
  const lactanciasDe = por(lactancias, "animal_id");
  const ubicacionActual = new Map(movimientos.filter((m) => m.hasta === null || m.hasta === undefined).map((m) => [texto(m.animal_id), texto(m.ubicacion_id)]));

  const urls = new Map<string, string>();
  const rutas = animales.map((a) => a.foto_path).filter((r): r is string => typeof r === "string" && r !== "");
  for (const [k, v] of await enlacesDe(cliente, "fotos-animales", rutas)) urls.set(k, v);

  const extras = ["Estado", "Fecha de baja", "Lote", "Foto"];
  const hoja = libro.addWorksheet("Animales", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  hoja.columns = [...COLUMNAS.map((c) => c.titulo), ...extras].map((t) => ({ width: anchoDe(t) }));
  encabezado(hoja, [...COLUMNAS.map((c) => (c.requerida ? `${c.titulo} *` : c.titulo)), ...extras]);

  for (const a of animales) {
    const id = texto(a.id);
    const hembra = a.sexo === "hembra";
    const susPartos = partosDe.get(id) ?? [];
    const ultimoParto = mayor(
      (lactanciasDe.get(id) ?? []).map((l) => texto(l.fecha_parto)).sort().at(-1),
      susPartos.filter((p) => p.tipo !== "aborto").map((p) => texto(p.fecha)).sort().at(-1),
    );
    const ultimoPartoRegistrado = susPartos.map((p) => texto(p.fecha)).sort().at(-1);
    const registrados = susPartos.filter((p) => p.tipo !== "aborto").length;
    const totalPartos = hembra ? Number(a.partos_previos ?? 0) + registrados : 0;
    const servicio = (serviciosDe.get(id) ?? []).sort((x, y) => texto(y.fecha).localeCompare(texto(x.fecha)))[0];
    const vigente = hembra && servicio && (!ultimoPartoRegistrado || texto(servicio.fecha) > ultimoPartoRegistrado) ? servicio : undefined;
    const gestante = vigente
      ? (diagnosticosDe.get(id) ?? []).some((d) => texto(d.fecha) >= texto(vigente.fecha) && d.resultado === "gestante")
      : false;

    const v: Record<Exclude<ColumnaId, "estado">, unknown> = {
      especie: a.especie === "caprino" ? "Caprino" : "Ovino",
      numero_arete: a.numero_arete,
      nombre: a.nombre,
      sexo: hembra ? "Hembra" : "Macho",
      raza: a.raza_id ? razas.get(texto(a.raza_id)) : null,
      fecha_nacimiento: a.fecha_nacimiento,
      nacimiento_aprox: a.fecha_nacimiento_aprox ? "Sí" : "No",
      padre_arete: a.padre_id ? arete.get(texto(a.padre_id)) : null,
      madre_arete: a.madre_id ? arete.get(texto(a.madre_id)) : null,
      padre_externo: a.padre_externo,
      madre_externa: a.madre_externa,
      origen: a.origen === "comprado" ? "Comprado" : "Nació en la finca",
      aptitud: hembra && a.vocacion ? humanizarOpcion(texto(a.vocacion)) : null,
      uso_macho: !hembra && a.uso_macho ? humanizarOpcion(texto(a.uso_macho)) : null,
      fecha_ultimo_parto: hembra ? ultimoParto : null,
      partos_total: hembra && totalPartos > 0 ? totalPartos : null,
      fecha_servicio: vigente?.fecha,
      tipo_servicio: vigente ? (TIPO_SERVICIO[texto(vigente.tipo)] ?? null) : null,
      semental_arete: vigente?.macho_id ? arete.get(texto(vigente.macho_id)) : null,
      semental_externo: vigente && !vigente.macho_id ? vigente.macho_externo : null,
      prenez_confirmada: vigente ? (gestante ? "Sí" : "No") : null,
      peso_nacer_kg: a.peso_nacer_kg,
      chip: a.chip,
      color: a.color,
      marcas: a.marcas,
      valor_compra: a.valor_compra,
      fecha_compra: a.fecha_compra,
      ubicacion: ubicacionActual.has(id) ? ubicaciones.get(ubicacionActual.get(id)!) : null,
      notas: a.notas,
    };
    const r = hoja.addRow([]);
    COLUMNAS.forEach((c, i) => escribirCelda(r, i, aCelda(c.id, v[c.id])));
    escribirCelda(r, COLUMNAS.length, { valor: humanizarOpcion(texto(a.estado)) });
    escribirCelda(r, COLUMNAS.length + 1, aCelda("fecha_baja", a.fecha_baja));
    escribirCelda(r, COLUMNAS.length + 2, { valor: a.lote_id ? (lotes.get(texto(a.lote_id)) ?? null) : null });
    if (typeof a.foto_path === "string" && a.foto_path) enlace(r, COLUMNAS.length + 3, urls.get(a.foto_path));
    r.commit();
  }
  await hoja.commit();
  return { hoja: "Animales", filas: animales.length };
}
