import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, SUPABASE_KEY, SUPABASE_URL, assertSupabaseEnv } from "@/lib/env";
import { hoyBogota } from "@/lib/fechas";
import { saludo } from "@/lib/animal";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { firmarJwt } from "@/lib/notificaciones/jwt";
import { armarResumen, type NivelMinimo } from "@/lib/notificaciones/mensajes";
import { enviarTelegram, escaparHtml, interpretarComando, type EventoTelegram } from "@/lib/notificaciones/telegram";
import type { Database, RolFinca } from "@/lib/tipos";

/** Lo que el servidor necesita para hablar con Telegram y con la base sin la sesión de una persona. Todo viene del entorno: nada en el repo. */
export type Entorno = { token: string; webhookSecret: string; despachoSecret: string; jwtSecret: string };

export function leerEntorno(): Partial<Entorno> {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    despachoSecret: process.env.DESPACHO_SECRET,
    jwtSecret: process.env.SUPABASE_JWT_SECRET,
  };
}

/**
 * Un cliente de la base que actúa «como» una persona (con su rol y la seguridad por finca de siempre) o como el servicio. El JWT vale 60 segundos y se firma
 * en cada llamada: nunca se guarda ni se devuelve.
 */
export function clienteComo(identidad: { userId: string } | "servicio", jwtSecret: string) {
  assertSupabaseEnv();
  const jwt = identidad === "servicio" ? firmarJwt({ role: "service_role", secreto: jwtSecret }) : firmarJwt({ sub: identidad.userId, role: "authenticated", secreto: jwtSecret });
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type Destino = { finca_id: string; user_id: string; rol: string };

/** El resumen de una persona en una finca, calculado como lo vería ella en la app. `null` si la finca no puede usar la app (plan vencido o sin activar). */
export async function resumenDe(destino: Destino, jwtSecret: string, ahora = new Date()) {
  const supabase = clienteComo({ userId: destino.user_id }, jwtSecret);
  const hoy = hoyBogota(ahora);
  const [{ data: finca }, { data: perfil }, { data: pref }, { data: vigencia }] = await Promise.all([
    supabase.from("fincas").select("id, nombre, plan").eq("id", destino.finca_id).maybeSingle(),
    supabase.from("perfiles").select("nombre").eq("id", destino.user_id).maybeSingle(),
    supabase.from("notificacion_preferencias").select("nivel_minimo").eq("finca_id", destino.finca_id).eq("user_id", destino.user_id).maybeSingle(),
    supabase.rpc("estado_vigencia_finca", { p_finca: destino.finca_id }),
  ]);
  if (!finca) throw new Error("La persona ya no puede ver esta finca.");
  if (vigencia === "bloqueada" || vigencia === "pendiente") return null;
  const ajustes = await leerAjustesFinca(supabase, finca.id);
  const senales = await cargarSemaforos({ supabase: supabase, fincaId: finca.id, rol: destino.rol as RolFinca, plan: finca.plan, hoy, ajustes });
  const nivelMinimo: NivelMinimo = pref?.nivel_minimo === "rojo" ? "rojo" : "ambar";
  return armarResumen({ nombre: perfil?.nombre ?? null, finca: finca.nombre, hoy, saludo: saludo(ahora), senales, nivelMinimo, urlBase: SITE_URL });
}

/** Arma el resumen de una persona sin enviarlo ni anotarlo: sirve para comprobar todo el circuito (secreto JWT, permisos, reglas) antes de conectar Telegram. */
export async function simularResumen(entorno: Pick<Entorno, "jwtSecret">, fincaId: string, userId: string): Promise<{ texto: string; mostrados: number; omitidos: number } | null> {
  const servicio = clienteComo("servicio", entorno.jwtSecret);
  const { data: miembro } = await servicio.from("finca_miembros").select("rol").eq("finca_id", fincaId).eq("user_id", userId).maybeSingle();
  if (!miembro) return null;
  return resumenDe({ finca_id: fincaId, user_id: userId, rol: miembro.rol }, entorno.jwtSecret);
}

const recorte = (e: unknown) => (e instanceof Error ? e.message : "Error desconocido").slice(0, 300);

export type ResultadoDespacho = { destinos: number; enviados: number; omitidos: number; fallidos: number };

/**
 * Manda los resúmenes que tocan ahora (lo llama n8n cada 15 minutos). Cada envío se reserva antes de mandarse: si dos llamadas se cruzan o n8n reintenta,
 * la segunda no lo repite. Un fallo se anota y se reintenta en la siguiente vuelta (hasta 3 veces); si la persona bloqueó el bot, se pausa su vínculo.
 */
export async function despachar(entorno: Entorno, ahora = new Date(), maximo = 30): Promise<ResultadoDespacho> {
  const servicio = clienteComo("servicio", entorno.jwtSecret);
  const { data: destinos, error } = await servicio.rpc("notificaciones_destinos", { p_ahora: ahora.toISOString() });
  if (error) throw new Error(error.message);
  const lista = (destinos ?? []).slice(0, maximo);
  const salida: ResultadoDespacho = { destinos: lista.length, enviados: 0, omitidos: 0, fallidos: 0 };

  const atender = async (d: (typeof lista)[number]) => {
    const { data: envioId } = await servicio.rpc("notificacion_reservar", { p_finca: d.finca_id, p_user: d.user_id, p_tipo: d.tipo, p_clave: d.clave });
    if (!envioId) return; // ya se envió (o se está enviando)
    try {
      const resumen = await resumenDe(d, entorno.jwtSecret, ahora);
      if (!resumen) {
        await servicio.rpc("notificacion_resultado", { p_id: envioId, p_estado: "omitido", p_error: "La finca no tiene el plan al día." });
        salida.omitidos++;
        return;
      }
      const r = await enviarTelegram(entorno.token, d.chat_id, resumen.texto);
      if (r.ok) {
        await servicio.rpc("notificacion_resultado", { p_id: envioId, p_estado: "enviado", p_message_id: r.messageId });
        salida.enviados++;
      } else {
        await servicio.rpc("notificacion_resultado", { p_id: envioId, p_estado: "fallido", p_error: r.error });
        if (r.bloqueado) await servicio.rpc("telegram_chat_estado", { p_chat_id: d.chat_id, p_estado: "bloqueado" });
        salida.fallidos++;
      }
    } catch (e) {
      await servicio.rpc("notificacion_resultado", { p_id: envioId, p_estado: "fallido", p_error: recorte(e) });
      salida.fallidos++;
    }
  };

  // De a tres a la vez: cada resumen hace varias consultas y Telegram limita el ritmo por chat, no por bot.
  for (let i = 0; i < lista.length; i += 3) await Promise.all(lista.slice(i, i + 3).map(atender));
  return salida;
}

const AYUDA =
  "Soy el bot de <b>Apriscol</b>. Te aviso lo que hay que hacer en tu finca.\n\n" +
  "/hoy — tu resumen ahora\n/pausar — dejo de escribirte\n/reanudar — vuelvo a escribirte\n\n" +
  "Para vincular tu cuenta: en Apriscol abre <b>Más → Telegram</b>, toca «Conectar» y luego el enlace que te sale.";

/** Atiende lo que llega al webhook: vincular con el código, pedir el resumen, pausar o reanudar. Siempre responde algo a una persona; nunca lanza hacia Telegram. */
export async function atenderEvento(evento: EventoTelegram, entorno: Entorno): Promise<void> {
  if (evento.tipo === "otro") return;
  const servicio = clienteComo("servicio", entorno.jwtSecret);
  if (evento.tipo === "bloqueo") {
    await servicio.rpc("telegram_chat_estado", { p_chat_id: evento.chatId, p_estado: "bloqueado" });
    return;
  }
  const responder = (texto: string) => enviarTelegram(entorno.token, evento.chatId, texto);
  if (!evento.privado) {
    await responder("Solo funciono en un chat privado conmigo. Escríbeme directamente.");
    return;
  }

  const { comando, argumento } = interpretarComando(evento.texto);
  switch (comando) {
    case "start": {
      if (!argumento) {
        await responder(AYUDA);
        return;
      }
      const { data } = await servicio.rpc("telegram_vincular", { p_codigo: argumento.slice(0, 32), p_chat_id: evento.chatId });
      if (data?.ok) {
        await responder(`Listo. Desde ahora te aviso lo que hay que hacer en <b>${escaparHtml(data.finca ?? "tu finca")}</b>.\n\nUsa /hoy para ver tu resumen ahora, o /pausar si quieres silenciarme.`);
      } else if (data?.motivo === "chat_en_uso") {
        await responder("Este Telegram ya está vinculado a otra persona de esa finca. Cada persona usa el suyo.");
      } else {
        await responder("Ese código no sirve o ya venció. Genera uno nuevo en Apriscol: <b>Más → Telegram</b>.");
      }
      return;
    }
    case "pausar":
    case "reanudar": {
      const { data: cambiados } = await servicio.rpc("telegram_chat_estado", { p_chat_id: evento.chatId, p_estado: comando === "pausar" ? "pausado" : "activo" });
      if (!cambiados) await responder(comando === "pausar" ? "No tengo avisos activos para pausar. Si ya estaban pausados, escribe /reanudar." : "No encuentro avisos para reanudar. Vincula tu cuenta en Apriscol: <b>Más → Telegram</b>.");
      else await responder(comando === "pausar" ? "Hecho: no te escribo más hasta que digas /reanudar." : "Listo, vuelvo a avisarte.");
      return;
    }
    case "hoy": {
      const { data: vinculos } = await servicio.from("telegram_vinculos").select("finca_id, user_id").eq("chat_id", evento.chatId).neq("estado", "pendiente").limit(3);
      if (!vinculos || vinculos.length === 0) {
        await responder("Todavía no estás vinculado. En Apriscol abre <b>Más → Telegram</b> y toca «Conectar».");
        return;
      }
      for (const v of vinculos) {
        try {
          const { data: miembro } = await servicio.from("finca_miembros").select("rol").eq("finca_id", v.finca_id).eq("user_id", v.user_id).maybeSingle();
          if (!miembro) continue;
          const resumen = await resumenDe({ finca_id: v.finca_id, user_id: v.user_id, rol: miembro.rol }, entorno.jwtSecret);
          await responder(resumen?.texto ?? "Esta finca no tiene el plan al día, así que no puedo mostrarte el resumen.");
        } catch (e) {
          console.error("[apriscol:telegram] /hoy", recorte(e));
          await responder("No pude armar tu resumen ahora. Intenta de nuevo en unos minutos.");
        }
      }
      return;
    }
    default:
      await responder(AYUDA);
  }
}
