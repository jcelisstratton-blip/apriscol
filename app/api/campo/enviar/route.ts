import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaEnvio, guardarDiagnosticoCampo, guardarMontaCampo, guardarOrdenoCampo, guardarPesoCampo, permisosCampo } from "@/lib/campo-servidor";
import { hoyBogota } from "@/lib/fechas";
import type { PlanId, RolFinca } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const responder = (cuerpo: object, status = 200) => NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
const rechazo = (error: string, status = 422) => responder({ ok: false, codigo: "rechazado", error }, status);

/**
 * Recibe UN registro hecho sin señal (ordeño, peso, monta o diagnóstico de gestación) desde la bandeja del celular. Exige sesión, que la petición venga de la propia app y que
 * la persona pueda registrar eso en ESA finca (la del registro, no la activa: pudo cambiar de finca antes de que volviera la señal).
 * Respuestas: 200 guardado o ya estaba · 409 ya había otro dato · 422/403 rechazado · 401 sin sesión (el celular lo guarda y espera).
 */
export async function POST(request: Request) {
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== request.headers.get("host")) return rechazo("Petición no permitida.", 403);

  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const usuario = claims?.claims?.sub;
  if (!usuario) return responder({ ok: false, error: "Entra de nuevo a Apriscol para enviar lo guardado." }, 401);

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return rechazo("El registro llegó dañado.", 400);
  }
  const datos = esquemaEnvio.safeParse(cuerpo);
  if (!datos.success) return rechazo("El registro llegó incompleto.", 400);
  const e = datos.data;

  const [{ data: miembro }, { data: finca }, { data: vigencia }] = await Promise.all([
    supabase.from("finca_miembros").select("rol").eq("finca_id", e.fincaId).eq("user_id", usuario).maybeSingle(),
    supabase.from("fincas").select("id, plan").eq("id", e.fincaId).maybeSingle(),
    supabase.rpc("estado_vigencia_finca", { p_finca: e.fincaId }),
  ]);
  if (!miembro || !finca) return rechazo("Ya no haces parte de la finca de este registro.", 403);
  if (vigencia === "gracia" || vigencia === "bloqueada" || vigencia === "pendiente") return rechazo("El plan de la finca no está al día: renuévalo para guardar este registro.", 403);
  const puede = permisosCampo(miembro.rol as RolFinca, finca.plan as PlanId);
  if (e.tipo === "ordeno" && !puede.leche) return rechazo("No tienes permiso para registrar ordeños en esta finca.", 403);
  if (e.tipo === "peso" && !puede.pesos) return rechazo("No tienes permiso para registrar pesos en esta finca.", 403);
  if ((e.tipo === "monta" || e.tipo === "diagnostico") && !puede.reproduccion) return rechazo("No tienes permiso para registrar reproducción en esta finca.", 403);

  const hoy = hoyBogota();
  const r =
    e.tipo === "ordeno"
      ? await guardarOrdenoCampo(supabase, e, hoy)
      : e.tipo === "peso"
        ? await guardarPesoCampo(supabase, e, hoy)
        : e.tipo === "monta"
          ? await guardarMontaCampo(supabase, e, hoy)
          : await guardarDiagnosticoCampo(supabase, e, hoy);
  if (r.ok) {
    revalidatePath(e.tipo === "ordeno" ? "/leche" : e.tipo === "peso" ? "/carne" : "/reproduccion");
    revalidatePath(`/hato/${e.animalId}`);
    return responder(r);
  }
  return responder(r, r.codigo === "conflicto" ? 409 : 422);
}
