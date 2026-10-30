import { leerEntorno, atenderEvento } from "@/lib/notificaciones/servidor";
import { leerEvento, secretoValido } from "@/lib/notificaciones/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * El webhook del bot. Telegram lo llama con el secreto que se le dio al registrarlo (`setWebhook` con `secret_token`); sin él no se hace nada. Siempre se responde 200
 * a un mensaje válido: si no, Telegram lo reenvía una y otra vez.
 */
export async function POST(req: Request) {
  const entorno = leerEntorno();
  if (!entorno.token || !entorno.webhookSecret || !entorno.secretKey) return new Response("El bot no está configurado.", { status: 503 });
  if (!secretoValido(req.headers.get("x-telegram-bot-api-secret-token"), entorno.webhookSecret)) {
    // Sin valores: solo que el secreto con que se registró el webhook no es el que tiene este despliegue.
    console.warn("[apriscol:telegram] webhook rechazado: el secreto no coincide");
    return new Response("No autorizado.", { status: 401 });
  }

  const cuerpo = await req.json().catch(() => null);
  try {
    await atenderEvento(leerEvento(cuerpo), { token: entorno.token, webhookSecret: entorno.webhookSecret, despachoSecret: entorno.despachoSecret ?? "", secretKey: entorno.secretKey });
  } catch (e) {
    console.error("[apriscol:telegram] webhook", (e instanceof Error ? e.message : "error").slice(0, 300));
  }
  return Response.json({ ok: true });
}
