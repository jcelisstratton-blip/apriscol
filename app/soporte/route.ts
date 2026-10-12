import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ES_RUTA_SOPORTE } from "@/lib/soportes";

/**
 * Abre un documento de respaldo: comprueba con la sesión que la persona puede verlo (la política de Storage decide) y la lleva a un
 * enlace temporal. Sin sesión, a iniciar sesión; sin permiso o si no existe, 404.
 */
export async function GET(req: NextRequest) {
  const ruta = req.nextUrl.searchParams.get("ruta") ?? "";
  if (!ES_RUTA_SOPORTE.test(ruta)) return new NextResponse("Documento no encontrado.", { status: 404 });
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return NextResponse.redirect(new URL("/login", req.url));
  const { data, error } = await supabase.storage.from("soportes").createSignedUrl(ruta, 120);
  if (error || !data) return new NextResponse("Documento no encontrado.", { status: 404 });
  const respuesta = NextResponse.redirect(data.signedUrl);
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
