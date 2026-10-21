import type { obtenerAjustes } from "@/lib/ajustes-servidor";
import type { obtenerContexto } from "@/lib/contexto";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { Animal } from "@/lib/tipos";

/**
 * Lo que comparten las tarjetas de la ficha del animal. Cada tarjeta es un componente de servidor que carga sus propios datos
 * (las consultas corren en paralelo) y devuelve `null` cuando no aplica al animal o al rol.
 */
export type CtxFicha = {
  id: string;
  animal: Animal;
  finca: Awaited<ReturnType<typeof obtenerContexto>>["finca"];
  rol: Awaited<ReturnType<typeof obtenerContexto>>["rol"];
  ajustes: Awaited<ReturnType<typeof obtenerAjustes>>;
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  /** Hoy en Colombia (AAAA-MM-DD). */
  hoy: string;
};
