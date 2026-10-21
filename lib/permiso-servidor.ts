import "server-only";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import type { ModuloApp } from "@/lib/tipos";

/**
 * Comprobación de permiso de una acción de servidor: `permisoPara("carne")("registrar pesos")` devuelve `{ ok: true, finca, rol }` o
 * `{ ok: false, error }` con un mensaje para la persona. La base vuelve a exigirlo (RLS); esto solo evita el viaje y da un mensaje claro.
 */
export const permisoPara = (modulo: ModuloApp) => async (verbo: string) => {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, modulo, finca.plan)) return { ok: false, error: `No tienes permiso para ${verbo} en esta finca.` } as const;
  return { ok: true, finca, rol } as const;
};
