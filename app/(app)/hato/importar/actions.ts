"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { leerArchivoAnimales } from "@/lib/importar-animales-excel";
import { opcionesImportar } from "@/lib/importar-animales-servidor";
import {
  MAX_BYTES_IMPORTAR,
  validarFilas,
  type AnimalExistente,
  type ErrorFila,
  type FilaParaGuardar,
  type FilaVista,
  type RazaRef,
  type ResultadoValidacion,
} from "@/lib/importar-animales";
import { traerTodo } from "@/lib/consultas";

export type RevisionImportacion =
  | { error: string }
  | { errores: ErrorFila[]; resumen: ResultadoValidacion["resumen"]; vista: FilaVista[] };

export type ResultadoGuardado = { error: string } | { animales: number; con_padres: number; con_parto: number; con_servicio: number; con_ubicacion: number };

/** Lee el archivo subido y aplica todas las reglas contra el hato de la finca activa. Nada se escribe aquí. */
async function procesar(form: FormData): Promise<{ error: string } | { resultado: ResultadoValidacion; filas: FilaParaGuardar[]; fincaId: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { error: "No tienes permiso para registrar animales en esta finca." };

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de Excel con tus animales." };
  if (archivo.size > MAX_BYTES_IMPORTAR) return { error: "El archivo es muy pesado (máximo 2 MB). Debe ser la plantilla con solo texto y fechas." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "Sube un archivo de Excel en formato .xlsx (el de la plantilla)." };

  const lectura = await leerArchivoAnimales(await archivo.arrayBuffer());
  if (!lectura.ok) return { error: lectura.error };

  const supabase = await crearClienteServidor();
  const { data: razas, error: eRazas } = await supabase.from("razas").select("id, especie, nombre").in("especie", finca.especies);
  if (eRazas) return { error: mensajeAmigable(eRazas.message) };

  // El hato actual, por tramos (PostgREST corta cada respuesta en 1000): sirve para detectar aretes repetidos y para resolver padres.
  let existentes: AnimalExistente[];
  try {
    existentes = (
      await traerTodo<AnimalExistente>((d, h) => supabase.from("animales").select("numero_arete, sexo, especie, fecha_nacimiento").eq("finca_id", finca.id).is("deleted_at", null).order("id").range(d, h))
    ).filas;
  } catch (e) {
    return { error: mensajeAmigable(e instanceof Error ? e.message : "No se pudo leer el hato.") };
  }

  const opciones = await opcionesImportar(supabase, finca, rol);
  if (opciones.error) return { error: mensajeAmigable(opciones.error) };

  const resultado = validarFilas(lectura.filas, {
    reproduccion: opciones.reproduccion,
    ubicaciones: opciones.ubicaciones,
    especies: finca.especies,
    razas: (razas ?? []) as RazaRef[],
    existentes,
    hoy: hoyBogota(),
    aptitudDefecto: finca.proposito,
  });
  if (resultado.errores.length === 0 && resultado.filas.length === 0) {
    return { error: resultado.resumen.omitidos > 0 ? "Todas las filas son de animales dados de baja (vendidos, muertos…): el cargue solo crea animales activos." : "No encontré animales para cargar en el archivo." };
  }
  return { resultado, filas: resultado.filas, fincaId: finca.id };
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
  const { data, error } = await supabase.rpc("importar_animales_lote", { p_finca: r.fincaId, p_filas: r.filas });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidatePath("/hato");
  revalidatePath("/");
  return data;
}
