import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/tipos";

// «/invitacion»: quien recibe el enlace sin tener cuenta debe poder ver a qué lo invitan y crearla (la pantalla pide sesión solo para aceptar).
// «/api/telegram» y «/api/notificaciones» no llevan sesión: las protege el secreto de cada una (webhook de Telegram y llamada de n8n). «/telegram» es la Mini App del bot: abre la sesión con la firma de Telegram (`/api/telegram/sesion`).
const PUBLICAS = ["/login", "/registro", "/recuperar", "/auth", "/terminos", "/privacidad", "/api/csp", "/api/telegram", "/api/notificaciones", "/telegram", "/invitacion"];

/** Refresca la sesión en cada navegación y manda a /login a quien no la tenga. */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aGuardar) => {
        aGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        aGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  // getClaims valida el JWT contra las llaves públicas del proyecto (no confiar en getSession en el servidor).
  const { data } = await supabase.auth.getClaims();
  const hayUsuario = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const esPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Una redirección es una respuesta nueva: hay que llevarle las cookies que Supabase acaba de escribir (por ejemplo, el borrado de una sesión
  // que ya no sirve); si no, el navegador se queda con la cookie vieja y vuelve a caer en lo mismo.
  const redirigir = (url: URL) => {
    const salida = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => salida.cookies.set(c));
    return salida;
  };

  if (!hayUsuario && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return redirigir(url);
  }
  if (hayUsuario && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirigir(url);
  }
  return respuesta;
}
