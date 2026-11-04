"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { analizarArchivo, leerFilasMapeadas } from "@/lib/importar-animales-excel";
import { MAX_BYTES_IMPORTAR, type ErrorFila } from "@/lib/importar-animales";
import { paraGuardarCatalogo, validarCatalogo, type ContextoCatalogo, type ResultadoCatalogo } from "@/lib/importar-catalogo";
import {
  CAMPOS_HISTORIA,
  CLAVE_HISTORIA,
  esCatalogo,
  puedeCargar,
  MAX_FILAS_HISTORIA,
  TIPOS_HISTORIA,
  TITULO_HISTORIA,
  faltantesHistoria,
  proponerMapeoHistoria,
  puntajeTituloHistoria,
  validarHistoria,
  type AnimalHato,
  type FilaHistoria,
  type MuestraHistoria,
  type ResumenHistoria,
  type TipoHistoria,
} from "@/lib/importar-historia";
import { campoRepetido } from "@/lib/importar-mapeo";
import { traerTodo } from "@/lib/consultas";
import type { HojaInfo } from "@/lib/importar-animales-excel";

export type ColumnaHistoria = { indice: number; encabezado: string; muestras: string[]; campo: string };
export type AnalisisHistoria = { error: string } | { hojas: HojaInfo[]; hoja: string; filaEncabezado: number; totalFilas: number; columnas: ColumnaHistoria[] };
export type RevisionHistoria = { error: string } | { errores: ErrorFila[]; resumen: ResumenHistoria; muestra: MuestraHistoria[] };
export type ResultadoHistoria = { error: string } | { importacion: string; creados: number; omitidos: number; /** Solo en medicamentos y alimento: cuántos productos nuevos se crearon. */ productos?: number };

const MUESTRAS_POR_COLUMNA = 3;
const textoForm = (form: FormData, clave: string) => {
  const v = form.get(clave);
  return typeof v === "string" ? v : "";
};

type Recibido = { error: string } | { tipo: TipoHistoria; finca: Awaited<ReturnType<typeof obtenerContexto>>["finca"]; buffer: ArrayBuffer; nombre: string };

async function recibir(form: FormData): Promise<Recibido> {
  const tipo = textoForm(form, "tipo") as TipoHistoria;
  if (!TIPOS_HISTORIA.includes(tipo)) return { error: "Ese tipo de cargue no existe." };
  const { finca, rol } = await obtenerContexto();
  const t = TITULO_HISTORIA[tipo];
  if (!puedeCargar(tipo, rol, finca.plan)) {
    return { error: tipo === "alimento" ? "Solo el propietario o un administrador puede cargar el inventario de alimento." : `No tienes permiso para registrar ${t.registro} en esta finca.` };
  }
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de Excel." };
  if (archivo.size > MAX_BYTES_IMPORTAR) return { error: "El archivo es muy pesado (máximo 4 MB). Guarda solo la hoja con los datos, sin imágenes." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "Sube un archivo de Excel en formato .xlsx. Si tu archivo es .xls o .csv, ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)»." };
  return { tipo, finca, buffer: await archivo.arrayBuffer(), nombre: archivo.name };
}

async function traerAnimales(fincaId: string): Promise<{ error: string } | { animales: AnimalHato[] }> {
  const supabase = await crearClienteServidor();
  try {
    const { filas } = await traerTodo<AnimalHato>((d, h) => supabase.from("animales").select("numero_arete, sexo").eq("finca_id", fincaId).is("deleted_at", null).order("id").range(d, h));
    return { animales: filas };
  } catch (e) {
    return { error: mensajeAmigable(e instanceof Error ? e.message : "No se pudo leer el hato.") };
  }
}

function leerMapeo(tipo: TipoHistoria, crudo: string): { error: string } | { mapeo: { indice: number; campo: string }[] } {
  const invalido = { error: "No se entendió qué columna es cuál. Vuelve a elegir el archivo." };
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return invalido;
  }
  if (!Array.isArray(datos) || datos.length > 120) return invalido;
  const validos = new Set(CAMPOS_HISTORIA[tipo].map((c) => c.id));
  const mapeo: { indice: number; campo: string }[] = [];
  for (const d of datos) {
    const i = (d as { indice?: unknown })?.indice;
    const c = (d as { campo?: unknown })?.campo;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i > 500 || typeof c !== "string" || !validos.has(c)) return invalido;
    mapeo.push({ indice: i, campo: c });
  }
  const repetido = campoRepetido(mapeo.map((m) => m.campo as never));
  if (repetido) return { error: `«${CAMPOS_HISTORIA[tipo].find((c) => c.id === repetido)?.titulo ?? repetido}» está en dos columnas. Cada dato va en una sola columna.` };
  const faltan = faltantesHistoria(tipo, mapeo.map((m) => m.campo));
  if (faltan.length > 0) return { error: `Indica cuál columna es «${faltan[0]}».` };
  return { mapeo };
}

/** Primer paso: abre el Excel y propone a qué dato corresponde cada columna. Nada se escribe. */
export async function analizarHistoria(form: FormData): Promise<AnalisisHistoria> {
  const r = await recibir(form);
  if ("error" in r) return r;
  const a = await analizarArchivo(r.buffer, {
    hoja: textoForm(form, "hoja") || undefined,
    reconocer: (t) => puntajeTituloHistoria(r.tipo, t),
    proponer: (cols) => proponerMapeoHistoria(r.tipo, cols),
  });
  if (!a.ok) return { error: a.error };
  return {
    hojas: a.hojas,
    hoja: a.hoja,
    filaEncabezado: a.filaEncabezado,
    totalFilas: a.totalFilas,
    columnas: a.columnas.map((c, i) => ({ indice: c.indice, encabezado: c.encabezado, muestras: [...new Set(c.valores.filter((v) => v !== ""))].slice(0, MUESTRAS_POR_COLUMNA), campo: a.propuesta[i] ?? "" })),
  };
}

/** Lo que ya existe en la finca (corrales, productos y alimentos), para reutilizarlo y saber en qué se cuenta cada producto. */
async function traerCatalogo(fincaId: string): Promise<{ error: string } | { ctx: ContextoCatalogo }> {
  const supabase = await crearClienteServidor();
  const [corrales, productos, alimentos] = await Promise.all([
    supabase.from("ubicaciones").select("nombre").eq("finca_id", fincaId).limit(2000),
    supabase.from("productos_veterinarios").select("nombre, presentacion, contenido_presentacion").eq("finca_id", fincaId).limit(2000),
    supabase.from("finca_productos").select("nombre, rubro").eq("finca_id", fincaId).eq("tipo", "compra").limit(2000),
  ]);
  const fallo = corrales.error ?? productos.error ?? alimentos.error;
  if (fallo) return { error: mensajeAmigable(fallo.message) };
  return {
    ctx: {
      hoy: hoyBogota(),
      corrales: (corrales.data ?? []).map((c) => c.nombre),
      productosVet: (productos.data ?? []).map((p) => ({ nombre: p.nombre, presentacion: p.presentacion, contenido_presentacion: p.contenido_presentacion == null ? null : Number(p.contenido_presentacion) })),
      alimentos: (alimentos.data ?? []).map((a) => ({ nombre: a.nombre, rubro: a.rubro ?? "" })),
    },
  };
}

type Procesado = { error: string } | { resultado: ResultadoCatalogo | ReturnType<typeof validarHistoria>; tipo: TipoHistoria; fincaId: string; nombre: string };

async function procesar(form: FormData): Promise<Procesado> {
  const r = await recibir(form);
  if ("error" in r) return r;
  const mapeo = leerMapeo(r.tipo, textoForm(form, "mapeo"));
  if ("error" in mapeo) return mapeo;
  const filaEncabezado = Number(textoForm(form, "filaEncabezado"));
  const lectura = await leerFilasMapeadas(r.buffer, {
    hoja: textoForm(form, "hoja") || undefined,
    filaEncabezado: Number.isInteger(filaEncabezado) && filaEncabezado >= 1 ? filaEncabezado : undefined,
    mapeo: mapeo.mapeo,
    requerido: CLAVE_HISTORIA[r.tipo],
    maxFilas: MAX_FILAS_HISTORIA,
    reconocer: (t) => puntajeTituloHistoria(r.tipo, t),
  });
  if (!lectura.ok) return { error: lectura.error };
  if (esCatalogo(r.tipo)) {
    const cat = await traerCatalogo(r.finca.id);
    if ("error" in cat) return cat;
    const resultado = validarCatalogo(r.tipo, lectura.filas, cat.ctx);
    if (resultado.errores.length === 0 && resultado.filas.length === 0) {
      return { error: r.tipo === "corrales" ? "Todos los corrales del archivo ya están en tu finca: no hay nada que crear." : "No encontré registros para cargar en el archivo." };
    }
    return { resultado, tipo: r.tipo, fincaId: r.finca.id, nombre: r.nombre };
  }
  const hato = await traerAnimales(r.finca.id);
  if ("error" in hato) return hato;
  const resultado = validarHistoria(r.tipo, lectura.filas, { animales: hato.animales, hoy: hoyBogota() });
  if (resultado.errores.length === 0 && resultado.filas.length === 0) return { error: "No encontré registros para cargar en el archivo." };
  return { resultado, tipo: r.tipo, fincaId: r.finca.id, nombre: r.nombre };
}

export async function revisarHistoria(form: FormData): Promise<RevisionHistoria> {
  const r = await procesar(form);
  if ("error" in r) return r;
  return { errores: r.resultado.errores, resumen: r.resultado.resumen, muestra: r.resultado.muestra };
}

/** Vuelve a leer y validar el archivo (no se confía en lo que el navegador ya revisó) y lo guarda todo en una sola transacción. */
export async function guardarHistoria(form: FormData): Promise<ResultadoHistoria> {
  const r = await procesar(form);
  if ("error" in r) return r;
  if (r.resultado.resumen.total_errores > 0) return { error: "El archivo tiene filas con problemas. Corrígelas y súbelo de nuevo." };
  const supabase = await crearClienteServidor();
  let data: unknown;
  if (esCatalogo(r.tipo)) {
    const filas = paraGuardarCatalogo(r.resultado.filas as ResultadoCatalogo["filas"]);
    const res = await supabase.rpc("importar_catalogo", { p_finca: r.fincaId, p_tipo: r.tipo, p_filas: filas, p_archivo: r.nombre });
    if (res.error) return { error: mensajeAmigable(res.error.message) };
    data = res.data;
  } else {
    const filas: FilaHistoria[] = r.resultado.filas as FilaHistoria[];
    const res = await supabase.rpc("importar_historial", { p_finca: r.fincaId, p_tipo: r.tipo, p_filas: filas, p_archivo: r.nombre });
    if (res.error) return { error: mensajeAmigable(res.error.message) };
    data = res.data;
  }
  revalidatePath("/hato");
  revalidatePath("/hato/migrar");
  revalidatePath("/hato/importar");
  revalidatePath("/leche");
  revalidatePath("/carne");
  revalidatePath("/inventario");
  revalidatePath("/hato");
  revalidatePath("/");
  return data as Extract<ResultadoHistoria, { importacion: string }>;
}
