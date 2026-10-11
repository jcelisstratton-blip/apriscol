import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/redireccion";

/** Destino del enlace del correo (confirmar cuenta, recuperar contraseña). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  const supabase = await crearClienteServidor();
  let error: unknown = new Error("enlace incompleto");
  if (tokenHash && tipo) {
    ({ error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  }
  if (!error) return NextResponse.redirect(new URL(next, origin));
  return NextResponse.redirect(new URL("/login?error=enlace", origin));
}
