import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/tipos";

const PUBLICAS = ["/login", "/registro", "/recuperar", "/auth", "/terminos", "/privacidad", "/api/csp"];

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

  if (!hayUsuario && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (hayUsuario && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return respuesta;
}
