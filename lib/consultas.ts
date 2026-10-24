/**
 * Leer muchas filas de PostgREST. Cada respuesta se corta en 1000 filas: sin esto, una lista «completa» queda en silencio con las primeras 1000.
 * Una sola implementación para todas las pantallas, descargas y cargues.
 */

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

/** Tope por defecto de filas por consulta: más allá se avisa que quedó incompleto en vez de colgarse. */
export const TOPE_FILAS = 20_000;
const POR_PAGINA = 1000;

/**
 * Recorre una consulta página por página. Cada consulta debe llevar un orden estable (`order`) para que las páginas no se repitan.
 * `porPagina` no puede ser mayor que lo que devuelve el servidor por respuesta (1000 en las tablas; las funciones de la app devuelven hasta 5000).
 */
export async function* paginar<T>(pagina: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>, porPagina = POR_PAGINA, tope = TOPE_FILAS): AsyncGenerator<{ filas: T[]; truncado: boolean }> {
  for (let desde = 0; desde < tope; desde += porPagina) {
    const { data, error } = await pagina(desde, desde + porPagina - 1);
    if (error) throw new Error(error.message);
    const filas = data ?? [];
    yield { filas, truncado: false };
    if (filas.length < porPagina) return;
  }
  // Se llenaron todas las páginas hasta el tope: solo se sabe si faltan filas preguntando por una más.
  const { data, error } = await pagina(tope, tope);
  if (error) throw new Error(error.message);
  yield { filas: [], truncado: (data ?? []).length > 0 };
}

/** Trae todas las filas de una consulta. Si se llega al tope, `truncado` lo dice: el reporte avisa en vez de mostrar algo incompleto como si fuera todo. */
export async function traerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>, opciones: { tope?: number; porPagina?: number } = {}): Promise<{ filas: T[]; truncado: boolean }> {
  const filas: T[] = [];
  let truncado = false;
  for await (const p of paginar(pagina, opciones.porPagina, opciones.tope)) {
    filas.push(...p.filas);
    truncado ||= p.truncado;
  }
  return { filas, truncado };
}

/** Parte una lista en tramos (las consultas con `in (...)` no admiten direcciones larguísimas). */
export function enTramos<T>(lista: T[], tamano = 100): T[][] {
  const tramos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) tramos.push(lista.slice(i, i + tamano));
  return tramos;
}

/**
 * Como `traerTodo`, pero con la forma `{ data }` de una respuesta de PostgREST: se cambia el `.limit(2000)` de una consulta por esto y el resto del código sigue igual.
 * Un error de la base se lanza (la pantalla de error de la marca y el registro de errores lo recogen) en vez de dejar una lista vacía que parece cierta.
 */
export async function leerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>, opciones: { tope?: number; porPagina?: number } = {}): Promise<{ data: T[]; truncado: boolean }> {
  const { filas, truncado } = await traerTodo(pagina, opciones);
  return { data: filas, truncado };
}
