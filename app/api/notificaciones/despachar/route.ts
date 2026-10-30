import { despachar, leerEntorno, simularResumen } from "@/lib/notificaciones/servidor";
import { secretoValido } from "@/lib/notificaciones/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Lo llama n8n cada 15 minutos con `Authorization: Bearer <DESPACHO_SECRET>`: manda los resúmenes que tocan ahora y responde cuántos salieron. */
export async function POST(req: Request) {
  const entorno = leerEntorno();
  if (!entorno.token || !entorno.despachoSecret || !entorno.secretKey) return new Response("Los avisos no están configurados.", { status: 503 });
  const recibido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secretoValido(recibido, entorno.despachoSecret)) return new Response("No autorizado.", { status: 401 });
  // Prueba: { "simular": { "finca_id": "...", "user_id": "..." } } devuelve el texto que recibiría esa persona, sin enviarlo ni anotarlo.
  const cuerpo = (await req.json().catch(() => null)) as { simular?: { finca_id?: string; user_id?: string } } | null;
  if (cuerpo?.simular) {
    const { finca_id, user_id } = cuerpo.simular;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!finca_id || !user_id || !UUID.test(finca_id) || !UUID.test(user_id)) return Response.json({ ok: false, error: "Indica finca_id y user_id." }, { status: 400 });
    try {
      const r = await simularResumen({ secretKey: entorno.secretKey }, finca_id, user_id);
      return r ? Response.json({ ok: true, ...r }) : Response.json({ ok: false, error: "Esa persona no es de esa finca, o la finca no tiene el plan al día." }, { status: 404 });
    } catch (e) {
      // Esta ruta ya exige el secreto de n8n: puede decir en qué paso falló (leer a la persona, preparar el acceso, abrir la sesión o consultar).
      const motivo = (e instanceof Error ? e.message : "error").slice(0, 300);
      console.error("[apriscol:telegram] simulación", motivo);
      return Response.json({ ok: false, error: motivo }, { status: 500 });
    }
  }
  try {
    const r = await despachar({ token: entorno.token, webhookSecret: entorno.webhookSecret ?? "", despachoSecret: entorno.despachoSecret, secretKey: entorno.secretKey });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("[apriscol:telegram] despacho", (e instanceof Error ? e.message : "error").slice(0, 300));
    return Response.json({ ok: false, error: "No se pudo despachar." }, { status: 500 });
  }
}
