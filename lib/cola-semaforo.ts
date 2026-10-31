/**
 * Cola de una señal del semáforo: al abrir un caso de una señal con varios (por ejemplo cuatro animales sin pesar), la lista queda guardada
 * en la pestaña para ofrecer «Anterior / Siguiente» en cualquier pantalla a la que se llegue, sin volver al resumen entre caso y caso.
 * Solo vive en `sessionStorage` (por pestaña); si no está disponible, la pantalla funciona igual, sin la barra.
 */
export type CasoCola = { etiqueta: string; href: string };
export type ColaSemaforo = { senal: string; titulo: string; area: string; indice: number; casos: CasoCola[] };

const LLAVE = "apriscol:cola-semaforo";
const MAX_CASOS = 100;

/** Ruta sin consulta ni ancla: para saber en qué caso de la cola estamos. */
export const rutaDe = (href: string) => href.split(/[?#]/)[0];

/**
 * Índice del caso en el que estamos. Si la ruta actual es la del caso guardado, se queda; si es la de un solo caso de la cola, es ese;
 * si es una pantalla intermedia (el formulario de registrar) o varios casos comparten la ruta, se queda en `previo`.
 */
export function indiceActual(cola: Pick<ColaSemaforo, "casos">, ruta: string, previo: number): number {
  const ultimo = cola.casos.length - 1;
  const base = Math.min(Math.max(previo, 0), ultimo);
  if (rutaDe(cola.casos[base].href) === ruta) return base;
  const coinciden = cola.casos.flatMap((c, i) => (rutaDe(c.href) === ruta ? [i] : []));
  return coinciden.length === 1 ? coinciden[0] : base;
}

/** Arma la cola desde el caso tocado. Con un solo caso no hay nada que recorrer (devuelve null). */
export function armarCola(senal: { id: string; titulo: string; area: string }, casos: CasoCola[], indice: number): ColaSemaforo | null {
  if (casos.length < 2) return null;
  const recortados = casos.slice(0, MAX_CASOS);
  return { senal: senal.id, titulo: senal.titulo, area: senal.area, indice: Math.min(indice, recortados.length - 1), casos: recortados };
}

const EVENTO = "apriscol:cola-semaforo";

export function guardarCola(cola: ColaSemaforo | null): void {
  try {
    if (cola) sessionStorage.setItem(LLAVE, JSON.stringify(cola));
    else sessionStorage.removeItem(LLAVE);
  } catch {
    /* sin almacenamiento: sin barra */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

/** Para `useSyncExternalStore`: avisa cuando la cola cambia en esta pestaña. */
export function suscribirCola(aviso: () => void): () => void {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

/** Lo guardado tal cual (texto estable entre lecturas, como pide `useSyncExternalStore`). */
export function colaCruda(): string | null {
  try {
    return sessionStorage.getItem(LLAVE);
  } catch {
    return null;
  }
}

export function leerCola(crudo: string | null = colaCruda()): ColaSemaforo | null {
  try {
    if (!crudo) return null;
    const c = JSON.parse(crudo) as ColaSemaforo;
    if (!c || !Array.isArray(c.casos) || c.casos.length < 2 || typeof c.senal !== "string") return null;
    // Solo rutas internas: lo guardado en el navegador no se sigue a ciegas.
    if (c.casos.some((x) => typeof x.href !== "string" || !x.href.startsWith("/") || x.href.startsWith("//"))) return null;
    return c;
  } catch {
    return null;
  }
}
