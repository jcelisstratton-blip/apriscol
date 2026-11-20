import { referenciaValida, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";

/**
 * La bandeja del celular (IndexedDB `apriscol-campo`): la copia de la finca (`referencia`) y lo registrado sin señal (`registros`). Solo en el
 * navegador. Nunca pasa por el service worker. Cada cambio avisa a la propia pestaña (evento `apriscol:campo`) y a las demás (BroadcastChannel).
 */
const BASE = "apriscol-campo";
const VERSION = 1;
const REFERENCIA = "referencia";
const REGISTROS = "registros";
const CLAVE_REFERENCIA = "actual";
export const EVENTO_CAMPO = "apriscol:campo";
const CANAL = "apriscol-campo";

let abierta: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Este navegador no permite guardar en el celular."));
  abierta ??= new Promise<IDBDatabase>((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(REFERENCIA)) db.createObjectStore(REFERENCIA);
      if (!db.objectStoreNames.contains(REGISTROS)) db.createObjectStore(REGISTROS, { keyPath: "id" });
    };
    pedido.onsuccess = () => {
      const db = pedido.result;
      // Si otra pestaña sube la versión, esta se cierra para no bloquearla.
      db.onversionchange = () => {
        db.close();
        abierta = null;
      };
      resolver(db);
    };
    pedido.onerror = () => {
      abierta = null;
      rechazar(pedido.error ?? new Error("No se pudo abrir el almacenamiento del celular."));
    };
  });
  return abierta;
}

async function operar<T>(tienda: string, modo: IDBTransactionMode, hacer: (t: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  return new Promise<T | undefined>((resolver, rechazar) => {
    const tx = db.transaction(tienda, modo);
    const pedido = hacer(tx.objectStore(tienda));
    let resultado: T | undefined;
    if (pedido) pedido.onsuccess = () => (resultado = pedido.result);
    tx.oncomplete = () => resolver(resultado);
    tx.onerror = () => rechazar(tx.error ?? new Error("No se pudo guardar en el celular."));
    tx.onabort = () => rechazar(tx.error ?? new Error("No se pudo guardar en el celular."));
  });
}

let canal: BroadcastChannel | null = null;
function avisar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_CAMPO));
  try {
    canal ??= typeof BroadcastChannel === "function" ? new BroadcastChannel(CANAL) : null;
    canal?.postMessage("cambio");
  } catch {
    // Sin canal entre pestañas: cada una se entera al volver a ella.
  }
}

/** Escucha los cambios de la bandeja (de esta pestaña y de las demás). Devuelve cómo dejar de escuchar. */
export function escucharCampo(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO_CAMPO, alCambiar);
  let propio: BroadcastChannel | null = null;
  try {
    propio = typeof BroadcastChannel === "function" ? new BroadcastChannel(CANAL) : null;
    if (propio) propio.onmessage = () => alCambiar();
  } catch {
    propio = null;
  }
  return () => {
    window.removeEventListener(EVENTO_CAMPO, alCambiar);
    propio?.close();
  };
}

export async function leerReferencia(): Promise<ReferenciaCampo | null> {
  try {
    return referenciaValida(await operar<unknown>(REFERENCIA, "readonly", (t) => t.get(CLAVE_REFERENCIA)));
  } catch {
    return null;
  }
}

export async function guardarReferencia(ref: ReferenciaCampo): Promise<void> {
  await operar(REFERENCIA, "readwrite", (t) => t.put(ref, CLAVE_REFERENCIA));
  avisar();
}

/** Al cerrar sesión: la copia de la finca no se queda en el aparato. Lo pendiente de enviar sí se queda (es trabajo de alguien). */
export async function borrarReferencia(): Promise<void> {
  try {
    await operar(REFERENCIA, "readwrite", (t) => t.delete(CLAVE_REFERENCIA));
    avisar();
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

export async function listarRegistros(): Promise<RegistroCampo[]> {
  try {
    return ((await operar<RegistroCampo[]>(REGISTROS, "readonly", (t) => t.getAll())) ?? []) as RegistroCampo[];
  } catch {
    return [];
  }
}

export async function guardarRegistro(r: RegistroCampo): Promise<void> {
  await operar(REGISTROS, "readwrite", (t) => t.put(r));
  avisar();
  // Que el navegador no borre lo guardado si se queda sin espacio (Android lo concede a una app instalada; iOS, si está en la pantalla de inicio).
  navigator.storage?.persist?.().catch(() => {});
}

export async function actualizarRegistro(id: string, cambios: Partial<RegistroCampo>): Promise<void> {
  const db = await abrir();
  await new Promise<void>((resolver, rechazar) => {
    const tx = db.transaction(REGISTROS, "readwrite");
    const tienda = tx.objectStore(REGISTROS);
    const pedido = tienda.get(id);
    pedido.onsuccess = () => {
      if (pedido.result) tienda.put({ ...pedido.result, ...cambios });
    };
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
  });
  avisar();
}

export async function borrarRegistros(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await operar(REGISTROS, "readwrite", (t) => {
    for (const id of ids) t.delete(id);
  });
  avisar();
}
