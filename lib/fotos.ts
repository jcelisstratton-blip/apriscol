import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";

/** URLs firmadas (1 hora) para mostrar fotos privadas de un bucket. Devuelve ruta → URL. */
export async function urlsFotos(
  supabase: SupabaseClient<Database>,
  bucket: "premios" | "fotos-animales",
  rutas: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicas = [...new Set(rutas.filter((r): r is string => !!r))];
  const mapa = new Map<string, string>();
  if (unicas.length === 0) return mapa;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unicas, 3600);
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl);
  });
  return mapa;
}

/** Fotos de premios de feria. */
export const urlsFotosPremios = (supabase: SupabaseClient<Database>, rutas: (string | null | undefined)[]) => urlsFotos(supabase, "premios", rutas);
