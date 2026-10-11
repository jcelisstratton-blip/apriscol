import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseEnv, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/tipos";

export async function crearClienteServidor() {
  // Leer las cookies primero marca la ruta como dinámica: nunca se prerenderiza una pantalla con sesión,
  // y si faltan las variables el error aparece al abrir la app (con mensaje claro), no al construirla.
  const cookieStore = await cookies();
  assertSupabaseEnv();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (aGuardar) => {
        try {
          aGuardar.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  });
}
