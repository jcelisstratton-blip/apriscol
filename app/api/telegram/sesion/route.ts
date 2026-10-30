import { leerEntorno, clienteServicio } from "@/lib/notificaciones/servidor";
import { rutaDeDestino, verificarInitData } from "@/lib/notificaciones/miniapp";
import { abrirSesionWeb } from "@/lib/notificaciones/sesion-web";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const no = (estado: number, motivo: string) => Response.json({ ok: false, motivo }, { status: estado });

/**
 * La Mini App del bot llama aquí al abrirse dentro de Telegram con lo que Telegram firmó (`initData`), la finca del mensaje (`f`) y la pantalla pedida (`d`, una clave
 * fija). Si la firma es válida y reciente y ese chat está vinculado a esa finca, abre la sesión de esa persona y responde a qué ruta ir. Nada de lo que manda el
 * navegador se usa sin comprobar: la firma exige el token del bot, la finca sale del vínculo y la ruta solo puede ser una de la lista.
 */
export async function POST(req: Request) {
  const entorno = leerEntorno();
  if (!entorno.token || !entorno.secretKey) return no(503, "no_configurado");
  const cuerpo = (await req.json().catch(() => null)) as { initData?: unknown; f?: unknown; d?: unknown } | null;
  if (!cuerpo || typeof cuerpo.initData !== "string" || typeof cuerpo.f !== "string" || typeof cuerpo.d !== "string" || !UUID.test(cuerpo.f)) return no(400, "formato");
  const ruta = rutaDeDestino(cuerpo.d);
  if (!ruta) return no(400, "formato");

  const firma = verificarInitData(cuerpo.initData, entorno.token);
  if (!firma.ok) return no(401, firma.motivo);

  const servicio = clienteServicio(entorno.secretKey);
  const { data: vinculo, error } = await servicio.from("telegram_vinculos").select("user_id").eq("chat_id", firma.userId).eq("finca_id", cuerpo.f).neq("estado", "pendiente").maybeSingle();
  if (error) {
    console.error("[apriscol:telegram] sesión web consulta:", error.message.slice(0, 200));
    return no(500, "consulta");
  }
  if (!vinculo) return no(403, "no_vinculado");

  const r = await abrirSesionWeb(vinculo.user_id, cuerpo.f, entorno.secretKey);
  if (!r.ok) {
    console.error("[apriscol:telegram] sesión web falló al", r.paso);
    return no(500, "sesion");
  }
  return Response.json({ ok: true, ruta });
}
