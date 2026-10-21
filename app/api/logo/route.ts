import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_LOGOS } from "@/lib/logo-finca";

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entrega el logo de una finca a quien es miembro de ella (la base decide con la sesión: sin sesión o de otra finca no hay nada).
 * La dirección lleva el nombre del archivo como versión (`v`), así que se puede guardar en el navegador para siempre; la ruta real sale de la
 * base, nunca de lo que llega en la dirección.
 */
export async function GET(request: Request) {
  const f = new URL(request.url).searchParams.get("f") ?? "";
  if (!ID_UUID.test(f)) return new Response(null, { status: 404 });
  const supabase = await crearClienteServidor();
  const { data: finca } = await supabase.from("fincas").select("logo_path").eq("id", f).maybeSingle();
  if (!finca?.logo_path) return new Response(null, { status: 404 });
  const { data: archivo, error } = await supabase.storage.from(BUCKET_LOGOS).download(finca.logo_path);
  if (error || !archivo) return new Response(null, { status: 404 });
  const tipo = ["image/png", "image/jpeg", "image/webp"].includes(archivo.type) ? archivo.type : "image/png";
  return new Response(archivo, {
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
