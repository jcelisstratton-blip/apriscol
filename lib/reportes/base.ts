import type { SupabaseClient } from "@supabase/supabase-js";
import type { AjustesCompletos } from "@/lib/ajustes";
import { etiquetaAnimal } from "@/lib/animal";
import type { Columna } from "@/lib/reportes/tipos";
import type { Animal, Database, Especie, ModuloApp } from "@/lib/tipos";

export type Cliente = SupabaseClient<Database>;

/** Todo lo que un informe necesita para armarse. Lo prepara el servidor con la sesión de la persona: la base decide qué filas ve. */
export type ContextoReporte = {
  supabase: Cliente;
  fincaId: string;
  hoy: string;
  ajustes: AjustesCompletos;
  /** Los filtros ya validados: una clave por filtro, siempre con un valor válido. */
  filtros: Record<string, string>;
  /** El periodo elegido (nulo = sin límite). */
  rango: { desde: string | null; hasta: string | null };
  /** Si el rol y el plan de la persona ven un módulo (para columnas que dependen de otro módulo). */
  puede: (modulo: ModuloApp) => boolean;
};

/** PostgREST corta cada respuesta en 1000 filas: se pide por páginas. */
const PAGINA = 1000;
/** Tope de filas por consulta: más allá, el reporte avisa que está incompleto en vez de colgarse. */
export const TOPE_FILAS = 20_000;

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

/** Trae todas las filas de una consulta, página por página. Cada consulta debe llevar un orden estable (`order`) para que las páginas no se repitan. */
export async function traerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>, tope = TOPE_FILAS): Promise<{ filas: T[]; truncado: boolean }> {
  const filas: T[] = [];
  for (let desde = 0; desde < tope; desde += PAGINA) {
    const { data, error } = await pagina(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

/** Parte una lista en tramos (las consultas con `in (...)` no admiten direcciones larguísimas). */
export function enTramos<T>(lista: T[], tamano = 100): T[][] {
  const tramos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) tramos.push(lista.slice(i, i + tamano));
  return tramos;
}

export type AnimalBase = Pick<Animal, "id" | "numero_arete" | "nombre" | "especie" | "sexo" | "estado" | "fecha_nacimiento" | "raza_id" | "lote_id" | "vocacion" | "uso_macho" | "partos_previos">;

/** Todos los animales de la finca (activos y dados de baja) por su id: sirve para poner nombre a cualquier fila de cualquier reporte. */
export async function cargarAnimales(c: Pick<ContextoReporte, "supabase" | "fincaId">): Promise<{ lista: AnimalBase[]; porId: Map<string, AnimalBase>; truncado: boolean }> {
  const { filas, truncado } = await traerTodo<AnimalBase>((d, h) =>
    c.supabase
      .from("animales")
      .select("id, numero_arete, nombre, especie, sexo, estado, fecha_nacimiento, raza_id, lote_id, vocacion, uso_macho, partos_previos")
      .eq("finca_id", c.fincaId)
      .is("deleted_at", null)
      .order("id")
      .range(d, h),
  );
  return { lista: filas, porId: new Map(filas.map((a) => [a.id, a])), truncado };
}

/** ¿Pasa el animal el filtro de especie del reporte? */
export const pasaEspecie = (c: Pick<ContextoReporte, "filtros">, especie: Especie) => !c.filtros.especie || c.filtros.especie === "todos" || c.filtros.especie === especie;

export const tituloAnimal = etiquetaAnimal;
export const hrefAnimal = (id: string, ancla = "") => `/hato/${id}${ancla}`;

/** Una nota estándar cuando una consulta llegó al tope de filas. */
export const NOTA_TRUNCADO = "El hato es muy grande y este reporte quedó incompleto en pantalla. Descarga el Excel para verlo entero.";

/** Atajos para declarar columnas. */
export const col = {
  texto: (clave: string, titulo: string, ancho = 18, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "texto", ancho, ...extra }),
  entero: (clave: string, titulo: string, ancho = 12, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "entero", ancho, ...extra }),
  decimal: (clave: string, titulo: string, ancho = 12, decimales = 1, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "decimal", ancho, decimales, ...extra }),
  fecha: (clave: string, titulo: string, ancho = 14, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "fecha", ancho, ...extra }),
  porcentaje: (clave: string, titulo: string, ancho = 12, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "porcentaje", ancho, ...extra }),
  pesos: (clave: string, titulo: string, ancho = 16, extra: Partial<Columna> = {}): Columna => ({ clave, titulo, tipo: "pesos", ancho, ...extra }),
};

/** Las dos columnas del animal que van solo al Excel (en pantalla ya están en el título de la fila). */
export const COLUMNAS_ANIMAL: Columna[] = [col.texto("arete", "Arete", 14, { soloExcel: true }), col.texto("nombre", "Nombre", 18, { soloExcel: true })];
export const valoresAnimal = (a: Pick<AnimalBase, "numero_arete" | "nombre">) => ({ arete: a.numero_arete, nombre: a.nombre });
