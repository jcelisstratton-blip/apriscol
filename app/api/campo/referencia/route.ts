import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { leerReferenciaCampo } from "@/lib/campo-servidor";
import { hoyBogota } from "@/lib/fechas";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * La copia de la finca activa para registrar sin señal (aretes, nombres, turnos, retiro y último peso). La pide el celular cada vez que abre
 * la app con señal (`components/MotorCampo.tsx`) y la guarda en el propio aparato. Sin sesión, 401 (nunca una redirección).
 */
export async function GET() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "Entra de nuevo a Apriscol." }, { status: 401, headers: SIN_CACHE });
  const { user, finca, rol, vigencia } = await obtenerContexto();
  if (vigencia === "bloqueada" || vigencia === "pendiente") return NextResponse.json({ error: "El plan de esta finca no está activo." }, { status: 403, headers: SIN_CACHE });
  const referencia = await leerReferenciaCampo(supabase, { usuarioId: user.id, finca, rol }, hoyBogota());
  return NextResponse.json(referencia, { headers: SIN_CACHE });
}
