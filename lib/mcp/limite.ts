/**
 * Tope de consultas por token: una ventana deslizante en memoria (por instancia del servidor). No es una barrera exacta entre instancias, pero frena un
 * asistente en bucle o un token filtrado: cada consulta además cuesta una sesión de base de datos.
 */
export const MAX_POR_HORA = 120;
const VENTANA_MS = 3_600_000;

export function crearLimitador(max = MAX_POR_HORA, ventanaMs = VENTANA_MS) {
  const marcas = new Map<string, number[]>();
  return {
    /** `true` si todavía puede consultar (y lo cuenta); `false` si ya llegó al tope. */
    permitir(clave: string, ahora = Date.now()): boolean {
      const recientes = (marcas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      if (recientes.length >= max) {
        marcas.set(clave, recientes);
        return false;
      }
      recientes.push(ahora);
      marcas.set(clave, recientes);
      if (marcas.size > 5000) for (const [k, v] of marcas) if (v.every((t) => ahora - t >= ventanaMs)) marcas.delete(k);
      return true;
    },
  };
}
