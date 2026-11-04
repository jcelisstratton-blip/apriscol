"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { analizarArchivo, leerArchivoAnimales, type HojaInfo, type MapeoColumnas } from "@/lib/importar-animales-excel";
import { opcionesImportar } from "@/lib/importar-animales-servidor";
import { CAMPOS_MAPEO, campoRepetido, faltantesDelMapeo } from "@/lib/importar-mapeo";
import {
  MAX_BYTES_IMPORTAR,
  MODOS_IMPORTAR,
  validarFilas,
  type AnimalExistente,
  type ColumnaId,
  type ErrorFila,
  type FilaParaGuardar,
  type FilaVista,
  type ModoImportar,
  type RazaRef,
  type ResultadoValidacion,
} from "@/lib/importar-animales";
import { traerTodo } from "@/lib/consultas";

export type ColumnaPropuesta = { indice: number; encabezado: string; muestras: string[]; campo: ColumnaId | "" };

export type AnalisisImportacion =
  | { error: string }
  | { hojas: HojaInfo[]; hoja: string; filaEncabezado: number; totalFilas: number; columnas: ColumnaPropuesta[] };

export type RevisionImportacion =
  | { error: string }
  | { errores: ErrorFila[]; resumen: ResultadoValidacion["resumen"]; vista: FilaVista[] };

export type ResultadoGuardado =
  | { error: string }
  | { importacion: string; animales: number; actualizados: number; sin_cambios: number; con_padres: number; con_parto: number; con_servicio: number; con_ubicacion: number };

export type ResultadoDeshacer = { error: string } | { eliminados: number; revertidos: number; conservados: number };

const MUESTRAS_POR_COLUMNA = 3;

/** El archivo subido, ya comprobado (permiso, tamaño y formato). */
async function recibirArchivo(form: FormData): Promise<{ error: string } | { buffer: ArrayBuffer; nombre: string; finca: Awaited<ReturnType<typeof obtenerContexto>>["finca"]; rol: Awaited<ReturnType<typeof obtenerContexto>>["rol"] }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { error: "No tienes permiso para registrar animales en esta finca." };
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de Excel con tus animales." };
  if (archivo.size > MAX_BYTES_IMPORTAR) return { error: "El archivo es muy pesado (máximo 4 MB). Guarda solo la hoja de animales, sin imágenes." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "Sube un archivo de Excel en formato .xlsx. Si tu archivo es .xls o .csv, ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)»." };
  return { buffer: await archivo.arrayBuffer(), nombre: archivo.name, finca, rol };
}

const textoForm = (form: FormData, clave: string) => {
  const v = form.get(clave);
  return typeof v === "string" ? v : "";
};

/** El mapa de columnas que confirmó la persona, comprobado: solo campos que existen y ninguno repetido. */
function leerMapeo(crudo: string): { error: string } | { mapeo: MapeoColumnas } {
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return { error: "No se entendió qué columna es cuál. Vuelve a elegir el archivo." };
  }
  const validos = new Set<string>(CAMPOS_MAPEO.map((c) => c.id));
  if (!Array.isArray(datos) || datos.length > 120) return { error: "No se entendió qué columna es cuál. Vuelve a elegir el archivo." };
  const mapeo: MapeoColumnas = [];
  for (const d of datos) {
    const i = (d as { indice?: unknown })?.indice;
    const c = (d as { campo?: unknown })?.campo;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i > 500 || typeof c !== "string" || !validos.has(c)) {
      return { error: "No se entendió qué columna es cuál. Vuelve a elegir el archivo." };
    }
    mapeo.push({ indice: i, campo: c as ColumnaId });
  }
  const repetido = campoRepetido(mapeo.map((m) => m.campo));
  if (repetido) return { error: `«${repetido}» está en dos columnas. Cada dato va en una sola columna.` };
  const faltan = faltantesDelMapeo(mapeo.map((m) => m.campo));
  if (faltan.length > 0) return { error: `Indica cuál columna es «${faltan[0]}»: es lo que identifica a cada animal.` };
  return { mapeo };
}

const leerModo = (crudo: string): ModoImportar => ((MODOS_IMPORTAR as readonly string[]).includes(crudo) ? (crudo as ModoImportar) : "nuevos");

/** Los aretes del hato: sirven para proponer si «Padre» es un arete o un nombre, y para detectar los animales que ya existen. */
async function traerHato(finca: { id: string }): Promise<{ error: string } | { existentes: AnimalExistente[] }> {
  const supabase = await crearClienteServidor();
  try {
    const { filas } = await traerTodo<AnimalExistente>((d, h) =>
      supabase.from("animales").select("numero_arete, sexo, especie, fecha_nacimiento").eq("finca_id", finca.id).is("deleted_at", null).order("id").range(d, h),
    );
    return { existentes: filas };
  } catch (e) {
    return { error: mensajeAmigable(e instanceof Error ? e.message : "No se pudo leer el hato.") };
  }
}

/** Primer paso: abre el Excel de la persona y le propone a qué campo corresponde cada columna. Nada se escribe. */
export async function analizarImportacion(form: FormData): Promise<AnalisisImportacion> {
  const r = await recibirArchivo(form);
  if ("error" in r) return r;
  const hato = await traerHato(r.finca);
  if ("error" in hato) return hato;
  const hoja = textoForm(form, "hoja") || undefined;
  const a = await analizarArchivo(r.buffer, { hoja, aretesDelHato: hato.existentes.map((e) => e.numero_arete) });
  if (!a.ok) return { error: a.error };
  return {
    hojas: a.hojas,
    hoja: a.hoja,
    filaEncabezado: a.filaEncabezado,
    totalFilas: a.totalFilas,
    columnas: a.columnas.map((c, i) => ({
      indice: c.indice,
      encabezado: c.encabezado,
      muestras: [...new Set(c.valores.filter((v) => v !== ""))].slice(0, MUESTRAS_POR_COLUMNA),
      campo: (a.propuesta[i] as ColumnaId | null) ?? "",
    })),
  };
}

/** Lee el archivo con las columnas confirmadas y aplica todas las reglas contra el hato de la finca activa. Nada se escribe aquí. */
async function procesar(form: FormData): Promise<{ error: string } | { resultado: ResultadoValidacion; filas: FilaParaGuardar[]; fincaId: string; modo: ModoImportar; nombre: string }> {
  const r = await recibirArchivo(form);
  if ("error" in r) return r;
  const { finca, rol } = r;
  const modo = leerModo(textoForm(form, "modo"));
  const mapeo = leerMapeo(textoForm(form, "mapeo"));
  if ("error" in mapeo) return mapeo;
  const filaEncabezado = Number(textoForm(form, "filaEncabezado"));

  const lectura = await leerArchivoAnimales(r.buffer, {
    hoja: textoForm(form, "hoja") || undefined,
    filaEncabezado: Number.isInteger(filaEncabezado) && filaEncabezado >= 1 ? filaEncabezado : undefined,
    mapeo: mapeo.mapeo,
  });
  if (!lectura.ok) return { error: lectura.error };

  const supabase = await crearClienteServidor();
  const { data: razas, error: eRazas } = await supabase.from("razas").select("id, especie, nombre").in("especie", finca.especies);
  if (eRazas) return { error: mensajeAmigable(eRazas.message) };
  const hato = await traerHato(finca);
  if ("error" in hato) return hato;
  const opciones = await opcionesImportar(supabase, finca, rol);
  if (opciones.error) return { error: mensajeAmigable(opciones.error) };

  const resultado = validarFilas(lectura.filas, {
    reproduccion: opciones.reproduccion,
    ubicaciones: opciones.ubicaciones,
    especies: finca.especies,
    razas: (razas ?? []) as RazaRef[],
    existentes: hato.existentes,
    hoy: hoyBogota(),
    aptitudDefecto: finca.proposito,
    modo,
  });
  if (resultado.errores.length === 0 && resultado.filas.length === 0) {
    if (resultado.resumen.ya_existen > 0) {
      return { error: "Todos los animales del archivo ya están en tu hato. Si quieres llenarles datos que les faltan, elige «Completar los que ya existen»." };
    }
    return { error: resultado.resumen.omitidos > 0 ? "Todas las filas son de animales dados de baja (vendidos, muertos…): el cargue solo trae animales activos." : "No encontré animales para cargar en el archivo." };
  }
  return { resultado, filas: resultado.filas, fincaId: finca.id, modo, nombre: r.nombre };
}

export async function revisarImportacion(form: FormData): Promise<RevisionImportacion> {
  const r = await procesar(form);
  if ("error" in r) return r;
  return { errores: r.resultado.errores, resumen: r.resultado.resumen, vista: r.resultado.vista };
}

/** Vuelve a leer y validar el archivo (no se confía en lo que el navegador ya revisó) y lo guarda todo en una sola transacción. */
export async function guardarImportacion(form: FormData): Promise<ResultadoGuardado> {
  const r = await procesar(form);
  if ("error" in r) return r;
  if (r.resultado.errores.length > 0) return { error: "El archivo tiene filas con problemas. Corrígelas y súbelo de nuevo." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("importar_animales", { p_finca: r.fincaId, p_filas: r.filas, p_modo: r.modo, p_archivo: r.nombre });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidatePath("/hato");
  revalidatePath("/hato/importar");
  revalidatePath("/");
  return data as Extract<ResultadoGuardado, { importacion: string }>;
}

/** Deshace un cargue completo (solo propietario o administrador): quita los animales que creó y devuelve lo que cambió en los que ya existían. */
export async function deshacerImportacion(importacion: string): Promise<ResultadoDeshacer> {
  const { rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador puede deshacer un cargue." };
  if (!/^[0-9a-f-]{36}$/i.test(importacion)) return { error: "Ese cargue no existe." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("deshacer_importacion", { p_importacion: importacion });
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/hato");
  revalidatePath("/hato/importar");
  revalidatePath("/");
  return data as Extract<ResultadoDeshacer, { eliminados: number }>;
}
