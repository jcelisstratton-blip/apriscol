import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clienteServicio, conSesionDe, leerEntorno } from "@/lib/notificaciones/servidor";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { hoyBogota } from "@/lib/fechas";
import { etiquetaAnimal, nombreTipo } from "@/lib/animal";
import { calcularTotales, resolverPeriodo, type FilaHistorial } from "@/lib/leche";
import { huellaDeToken, type Credencial } from "@/lib/mcp/token";
import type { ContextoMcp, Datos } from "@/lib/mcp/herramientas";
import type { Database, PlanId, RolFinca } from "@/lib/tipos";

type ClienteBase = ReturnType<typeof clienteServicio>;
/** Corre `fn` como la persona (su rol y la seguridad por finca de siempre). */
export type Como = <T>(fn: (supabase: ClienteBase) => Promise<T>) => Promise<T>;
/** `clave` identifica a la conexión para el tope de consultas; `como` es cómo se consulta como la persona. */
export type Autenticado = { clave: string; userId: string; fincaId: string; ctx: ContextoMcp; como: Como };
export type ResultadoAuth = { ok: true; auth: Autenticado } | { ok: false; estado: 401 | 403 | 503; motivo: string };

/** Cada cuánto se anota «último uso» (no en cada consulta). */
const REFRESCO_USO_MS = 5 * 60_000;

/**
 * Identifica al dueño del token y comprueba que sigue siendo miembro de esa finca y que la finca puede usar la app. El rol se lee de la base en cada
 * consulta: si lo cambian o lo sacan de la finca, el token deja de dar lo que daba (o deja de existir por la llave compuesta).
 */
async function autenticarToken(token: string): Promise<ResultadoAuth> {
  const { secretKey } = leerEntorno();
  if (!secretKey) return { ok: false, estado: 503, motivo: "La conexión con IA no está disponible por ahora." };
  const servicio = clienteServicio(secretKey);
  const { data: fila, error } = await servicio.from("tokens_ia").select("id, user_id, finca_id, ultimo_uso").eq("huella", huellaDeToken(token)).is("revocado_en", null).maybeSingle();
  if (error) {
    console.error("[apriscol:mcp] buscar token:", error.message.slice(0, 200));
    return { ok: false, estado: 503, motivo: "No se pudo verificar la conexión. Intenta de nuevo." };
  }
  if (!fila) return { ok: false, estado: 401, motivo: "El token no es válido o fue revocado." };

  const [{ data: miembro }, { data: finca }, { data: vigencia }] = await Promise.all([
    servicio.from("finca_miembros").select("rol").eq("finca_id", fila.finca_id).eq("user_id", fila.user_id).maybeSingle(),
    servicio.from("fincas").select("nombre, plan, moneda").eq("id", fila.finca_id).maybeSingle(),
    servicio.rpc("estado_vigencia_finca", { p_finca: fila.finca_id }),
  ]);
  if (!miembro || !finca) return { ok: false, estado: 401, motivo: "El token no es válido o fue revocado." };
  if (vigencia === "bloqueada" || vigencia === "pendiente") return { ok: false, estado: 403, motivo: "El plan de la finca no está activo." };

  if (!fila.ultimo_uso || Date.now() - new Date(fila.ultimo_uso).getTime() > REFRESCO_USO_MS) {
    void servicio.from("tokens_ia").update({ ultimo_uso: new Date().toISOString() }).eq("id", fila.id).then(undefined, () => undefined);
  }
  return {
    ok: true,
    auth: { clave: `token:${fila.id}`, userId: fila.user_id, fincaId: fila.finca_id, como: (fn) => conSesionDe(fila.user_id, secretKey, fn), ctx: { fincaNombre: finca.nombre, rol: miembro.rol as RolFinca, plan: finca.plan as PlanId, hoy: hoyBogota(), moneda: finca.moneda } },
  };
}

const num = (f: { fecha: string; jornada: string; litros_tanque: unknown; litros_descartados: unknown; ordenos: number; animales: number }): FilaHistorial => ({
  fecha: f.fecha,
  jornada: f.jornada,
  litros_tanque: Number(f.litros_tanque),
  litros_descartados: Number(f.litros_descartados),
  ordenos: f.ordenos,
  animales: f.animales,
});
const escaparLike = (t: string) => t.replace(/[\\%_]/g, "\\$&");

/** Las lecturas de las herramientas. Cada una corre como la persona (su rol y la seguridad por finca de siempre), nunca con la llave de servicio. */
export function datosDe(auth: Autenticado): Datos {
  const { ctx, fincaId, como } = auth;
  return {
    senales: () =>
      como(async (supabase) => {
        const ajustes = await leerAjustesFinca(supabase, fincaId);
        return cargarSemaforos({ supabase, fincaId, rol: ctx.rol, plan: ctx.plan, hoy: ctx.hoy, ajustes, moneda: ctx.moneda });
      }),
    buscarAnimales: (texto) =>
      como(async (supabase) => {
        const patron = `%${escaparLike(texto)}%`;
        const columnas = "numero_arete, nombre, especie, sexo, estado, fecha_nacimiento";
        const [porNombre, porArete] = await Promise.all([
          supabase.from("animales").select(columnas).eq("finca_id", fincaId).ilike("nombre", patron).order("numero_arete").limit(10),
          supabase.from("animales").select(columnas).eq("finca_id", fincaId).ilike("numero_arete", patron).order("numero_arete").limit(10),
        ]);
        if (porNombre.error || porArete.error) throw new Error((porNombre.error ?? porArete.error)!.message);
        const unicos = new Map([...(porArete.data ?? []), ...(porNombre.data ?? [])].map((a) => [a.numero_arete, a]));
        return [...unicos.values()].slice(0, 10).map((a) => ({ etiqueta: etiquetaAnimal(a), tipo: nombreTipo(a.especie, a.sexo), estado: a.estado, nacimiento: a.fecha_nacimiento }));
      }),
    leche: (dias) =>
      como(async (supabase) => {
        const periodo = resolverPeriodo({ periodo: String(dias) }, ctx.hoy, null);
        const pedir = (desde: string, hasta: string) => supabase.rpc("produccion_historial", { p_finca: fincaId, p_desde: desde, p_hasta: hasta, p_animal: null });
        const [actual, previo] = await Promise.all([pedir(periodo.desde, periodo.hasta), periodo.anterior ? pedir(periodo.anterior.desde, periodo.anterior.hasta) : Promise.resolve({ data: null, error: null })]);
        if (actual.error || previo.error) throw new Error((actual.error ?? previo.error)!.message);
        return { desde: periodo.desde, hasta: periodo.hasta, dias: periodo.dias, totales: calcularTotales((actual.data ?? []).map(num)), previo: previo.data ? calcularTotales(previo.data.map(num)) : null };
      }),
  };
}


const SIN_SESION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;
const NO_VALIDO: ResultadoAuth = { ok: false, estado: 401, motivo: "El acceso no es válido o venció. Vuelve a conectar Apriscol desde Claude." };

/**
 * El acceso que Claude recibió al tocar «Permitir» (OAuth). Es un JWT que emite Supabase para esa persona: se valida contra las llaves públicas del proyecto
 * y se exige el `client_id` de la aplicación autorizada (así una sesión normal de la web no sirve aquí). Las consultas van con ese mismo JWT: la persona,
 * su rol y la seguridad por finca de siempre, sin llave de servicio. La finca es la que la persona tiene activa en la app.
 */
async function autenticarOauth(jwt: string): Promise<ResultadoAuth> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, estado: 503, motivo: "La conexión con IA no está disponible por ahora." };
  // `getClaims` lanza una excepción (no devuelve error) si el JWT viene mal formado: un acceso inválido siempre es un 401, nunca un 500.
  const { data, error } = await createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: SIN_SESION })
    .auth.getClaims(jwt)
    .catch(() => ({ data: null, error: new Error("jwt") }));
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated" || typeof claims.client_id !== "string" || !claims.client_id) return NO_VALIDO;
  const userId = claims.sub;
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: SIN_SESION });

  const [{ data: perfil }, { data: miembros }] = await Promise.all([
    supabase.from("perfiles").select("finca_activa_id").eq("id", userId).maybeSingle(),
    supabase.from("finca_miembros").select("finca_id, rol").eq("user_id", userId),
  ]);
  const elegida = (miembros ?? []).find((m) => m.finca_id === perfil?.finca_activa_id) ?? (miembros ?? [])[0];
  if (!elegida) return { ok: false, estado: 403, motivo: "Tu cuenta no tiene una finca en Apriscol." };
  const [{ data: finca }, { data: vigencia }] = await Promise.all([
    supabase.from("fincas").select("nombre, plan, moneda").eq("id", elegida.finca_id).maybeSingle(),
    supabase.rpc("estado_vigencia_finca", { p_finca: elegida.finca_id }),
  ]);
  if (!finca) return { ok: false, estado: 403, motivo: "Tu cuenta no tiene una finca en Apriscol." };
  if (vigencia === "bloqueada" || vigencia === "pendiente") return { ok: false, estado: 403, motivo: "El plan de la finca no está activo." };
  return {
    ok: true,
    auth: { clave: `oauth:${userId}:${claims.client_id}`, userId, fincaId: elegida.finca_id, como: (fn) => fn(supabase), ctx: { fincaNombre: finca.nombre, rol: elegida.rol as RolFinca, plan: finca.plan as PlanId, hoy: hoyBogota(), moneda: finca.moneda } },
  };
}

/** Identifica a quien consulta, venga con un token personal o con el acceso de Claude por OAuth. */
export const autenticar = (c: Credencial): Promise<ResultadoAuth> => (c.tipo === "token" ? autenticarToken(c.token) : autenticarOauth(c.jwt));
