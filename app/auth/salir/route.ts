import { NextResponse, type NextRequest } from "next/server";
import { esCookieDeSesion } from "@/lib/supabase/sesion";

export const dynamic = "force-dynamic";

/**
 * Sesión que el servidor ya no reconoce (se cerró en otro aparato, venció el permiso de renovación…) pero cuya cookie sigue en el navegador:
 * la cookie parece válida para el filtro de entrada y la pantalla dice que no hay usuario, y las dos se mandaban de un lado a otro sin fin
 * («te redireccionó demasiadas veces»). Aquí se borran las cookies de la sesión y se manda a entrar de nuevo. Es una ruta pública (`/auth`).
 */
export function GET(request: NextRequest) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  const respuesta = NextResponse.redirect(destino);
  for (const { name } of request.cookies.getAll()) {
    if (esCookieDeSesion(name)) respuesta.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
