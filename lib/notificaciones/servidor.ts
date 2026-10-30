import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, SUPABASE_KEY, SUPABASE_URL, assertSupabaseEnv } from "@/lib/env";
import { hoyBogota } from "@/lib/fechas";
import { saludo } from "@/lib/animal";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { armarDetalleArea, armarResumen, leerAccion, type EntradaResumen, type NivelMinimo, type Resumen } from "@/lib/notificaciones/mensajes";
import { editarTelegram, enviarTelegram, escaparHtml, interpretarComando, responderAccion, type Boton, type EventoTelegram } from "@/lib/notificaciones/telegram";
import type { Database, RolFinca } from "@/lib/tipos";

/** Lo que el servidor necesita para hablar con Telegram y con la base sin la sesión de una persona. Todo viene del entorno: nada en el repo. */
export type Entorno = { token: string; webhookSecret: string; despachoSecret: string; secretKey: string };

export function leerEntorno(): Partial<Entorno> {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    despachoSecret: process.env.DESPACHO_SECRET,
    secretKey: process.env.SUPABASE_SECRET_KEY,
  };
}

const SIN_SESION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/** Cliente con la llave secreta de Supabase (`sb_secret_…`): ve todo y se salta la seguridad por finca. Solo para las funciones del bot. Nunca al navegador. */
export function clienteServicio(secretKey: string) {
  assertSupabaseEnv();
  return createClient<Database>(SUPABASE_URL, secretKey, { auth: SIN_SESION });
}

/**
 * Corre `fn` con un cliente que actúa «como» una persona: con su rol y la seguridad por finca de siempre, igual que si estuviera en la app. Para eso se pide a
 * Supabase una sesión de esa persona (enlace de acceso de un solo uso, canjeado en el acto, sin correo) y al terminar se cierra. No se firma nada a mano: la sesión
 * la emite Supabase con su llave vigente. Cada persona del reparto cuesta tres llamadas cortas.
 */
export async function conSesionDe<T>(userId: string, secretKey: string, fn: (supabase: ReturnType<typeof clienteServicio>) => Promise<T>): Promise<T> {
  const admin = clienteServicio(secretKey);
  const { data: usuario, error: errUsuario } = await admin.auth.admin.getUserById(userId);
  if (errUsuario || !usuario.user?.email) throw new Error(`No se pudo leer a la persona: ${errUsuario?.message ?? "no tiene correo"}`);
  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({ type: "magiclink", email: usuario.user.email });
  if (errEnlace || !enlace.properties?.hashed_token) throw new Error(`No se pudo preparar el acceso: ${errEnlace?.message ?? "sin código"}`);
  const anonimo = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: SIN_SESION });
  const { data: sesion, error: errSesion } = await anonimo.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: "magiclink" });
  if (errSesion || !sesion.session) throw new Error(`No se pudo abrir la sesión: ${errSesion?.message ?? "sin sesión"}`);
  const jwt = sesion.session.access_token;
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: SIN_SESION });
  try {
    return await fn(supabase);
  } finally {
    await admin.auth.admin.signOut(jwt, "local").catch(() => undefined);
  }
}

type Destino = { finca_id: string; user_id: string; rol: string };

/** Los datos de una persona en una finca, como los vería ella en la app. `null` si la finca no puede usar la app (plan vencido o sin activar). */
export async function contextoDe(destino: Destino, secretKey: string, ahora = new Date()): Promise<EntradaResumen | null> {
  return conSesionDe(destino.user_id, secretKey, async (supabase) => {
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
    const senales = await cargarSemaforos({ supabase, fincaId: finca.id, rol: destino.rol as RolFinca, plan: finca.plan, hoy, ajustes });
    const nivelMinimo: NivelMinimo = pref?.nivel_minimo === "rojo" ? "rojo" : "ambar";
    return { nombre: perfil?.nombre ?? null, finca: finca.nombre, fincaId: finca.id, hoy, saludo: saludo(ahora), senales, nivelMinimo, urlBase: SITE_URL };
  });
}

/** El resumen de una persona en una finca. */
export async function resumenDe(destino: Destino, secretKey: string, ahora = new Date()): Promise<Resumen | null> {
  const contexto = await contextoDe(destino, secretKey, ahora);
  return contexto ? armarResumen(contexto) : null;
}

/** Arma el resumen de una persona sin enviarlo ni anotarlo: sirve para comprobar todo el circuito (secreto JWT, permisos, reglas) antes de conectar Telegram. */
export async function simularResumen(entorno: Pick<Entorno, "secretKey">, fincaId: string, userId: string): Promise<Resumen | null> {
  const servicio = clienteServicio(entorno.secretKey);
  const { data: miembro } = await servicio.from("finca_miembros").select("rol").eq("finca_id", fincaId).eq("user_id", userId).maybeSingle();
  if (!miembro) return null;
  return resumenDe({ finca_id: fincaId, user_id: userId, rol: miembro.rol }, entorno.secretKey);
}

const recorte = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : "Error desconocido").slice(0, 300);

export type ResultadoDespacho = { destinos: number; enviados: number; omitidos: number; fallidos: number };

/**
 * Manda los resúmenes que tocan ahora (lo llama n8n cada 15 minutos). Cada envío se reserva antes de mandarse: si dos llamadas se cruzan o n8n reintenta,
 * la segunda no lo repite. Un fallo se anota y se reintenta en la siguiente vuelta (hasta 3 veces); si la persona bloqueó el bot, se pausa su vínculo.
 */
export async function despachar(entorno: Entorno, ahora = new Date(), maximo = 30): Promise<ResultadoDespacho> {
  const servicio = clienteServicio(entorno.secretKey);
  const { data: destinos, error } = await servicio.rpc("notificaciones_destinos", { p_ahora: ahora.toISOString() });
  if (error) throw new Error(error.message);
  const lista = (destinos ?? []).slice(0, maximo);
  const salida: ResultadoDespacho = { destinos: lista.length, enviados: 0, omitidos: 0, fallidos: 0 };

  const atender = async (d: (typeof lista)[number]) => {
    const { data: envioId } = await servicio.rpc("notificacion_reservar", { p_finca: d.finca_id, p_user: d.user_id, p_tipo: d.tipo, p_clave: d.clave });
    if (!envioId) return; // ya se envió (o se está enviando)
    try {
      const resumen = await resumenDe(d, entorno.secretKey, ahora);
      if (!resumen) {
        await servicio.rpc("notificacion_resultado", { p_id: envioId, p_estado: "omitido", p_error: "La finca no tiene el plan al día." });
        salida.omitidos++;
        return;
      }
      const r = await enviarTelegram(entorno.token, d.chat_id, resumen.texto, resumen.botones);
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

/**
 * Atiende un botón del resumen: «ver el detalle de un área» o «volver al resumen». Solo se muestra lo de una finca a la que ese chat está vinculado (el dato del botón
 * viene de Telegram y no se da por bueno), y el mensaje se edita en su lugar para no llenar el chat.
 */
async function atenderAccion(evento: Extract<EventoTelegram, { tipo: "accion" }>, entorno: Entorno, servicio: ReturnType<typeof clienteServicio>): Promise<void> {
  const accion = leerAccion(evento.datos);
  if (!accion) {
    await responderAccion(entorno.token, evento.id, "Ese botón ya no sirve. Escribe /hoy para ver tu resumen.");
    return;
  }
  const { data: vinculo, error } = await servicio.from("telegram_vinculos").select("user_id").eq("chat_id", evento.chatId).eq("finca_id", accion.fincaId).neq("estado", "pendiente").maybeSingle();
  if (error) console.error("[apriscol:telegram] botón consulta:", recorte(error.message));
  if (!vinculo) {
    await responderAccion(entorno.token, evento.id, error ? "No pude consultar tu cuenta. Intenta de nuevo." : "Ese aviso ya no está vinculado a tu cuenta.");
    return;
  }
  await responderAccion(entorno.token, evento.id); // quita el círculo de «cargando» de inmediato: armar el detalle tarda unos segundos
  try {
    const { data: miembro } = await servicio.from("finca_miembros").select("rol").eq("finca_id", accion.fincaId).eq("user_id", vinculo.user_id).maybeSingle();
    if (!miembro) return;
    const contexto = await contextoDe({ finca_id: accion.fincaId, user_id: vinculo.user_id, rol: miembro.rol }, entorno.secretKey);
    if (!contexto) return;
    const r = accion.tipo === "area" ? armarDetalleArea({ ...contexto, area: accion.area }) : armarResumen(contexto);
    const e = await editarTelegram(entorno.token, evento.chatId, evento.messageId, r.texto, r.botones);
    if (!e.ok) console.error("[apriscol:telegram] detalle no enviado:", e.error);
  } catch (e) {
    console.error("[apriscol:telegram] botón:", recorte(e));
  }
}

/** Atiende lo que llega al webhook: vincular con el código, pedir el resumen, pausar o reanudar. Siempre responde algo a una persona; nunca lanza hacia Telegram. */
export async function atenderEvento(evento: EventoTelegram, entorno: Entorno): Promise<void> {
  if (evento.tipo === "otro") return;
  const servicio = clienteServicio(entorno.secretKey);
  if (evento.tipo === "bloqueo") {
    await servicio.rpc("telegram_chat_estado", { p_chat_id: evento.chatId, p_estado: "bloqueado" });
    return;
  }
  if (evento.tipo === "accion") {
    await atenderAccion(evento, entorno, servicio);
    return;
  }
  const responder = async (texto: string, botones: Boton[][] = []) => {
    const r = await enviarTelegram(entorno.token, evento.chatId, texto, botones);
    if (!r.ok) console.error("[apriscol:telegram] respuesta no enviada:", r.error);
    return r;
  };
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
      const { data, error } = await servicio.rpc("telegram_vincular", { p_codigo: argumento.slice(0, 32), p_chat_id: evento.chatId });
      if (error) console.error("[apriscol:telegram] vincular:", recorte(error.message));
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
      const { data: vinculos, error } = await servicio.from("telegram_vinculos").select("finca_id, user_id").eq("chat_id", evento.chatId).neq("estado", "pendiente").limit(3);
      if (error) {
        // Sin esto, una llave mal puesta se vería como «todavía no estás vinculado».
        console.error("[apriscol:telegram] /hoy consulta:", recorte(error.message));
        await responder("No pude consultar tu cuenta ahora. Intenta de nuevo en unos minutos.");
        return;
      }
      if (!vinculos || vinculos.length === 0) {
        await responder("Todavía no estás vinculado. En Apriscol abre <b>Más → Telegram</b> y toca «Conectar».");
        return;
      }
      for (const v of vinculos) {
        try {
          const { data: miembro } = await servicio.from("finca_miembros").select("rol").eq("finca_id", v.finca_id).eq("user_id", v.user_id).maybeSingle();
          if (!miembro) continue;
          const resumen = await resumenDe({ finca_id: v.finca_id, user_id: v.user_id, rol: miembro.rol }, entorno.secretKey);
          if (resumen) await responder(resumen.texto, resumen.botones);
          else await responder("Esta finca no tiene el plan al día, así que no puedo mostrarte el resumen.");
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
