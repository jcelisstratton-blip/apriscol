import "server-only";
import { clienteServicio, conSesionDe, leerEntorno } from "@/lib/notificaciones/servidor";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { hoyBogota } from "@/lib/fechas";
import { etiquetaAnimal, nombreTipo } from "@/lib/animal";
import { calcularTotales, resolverPeriodo, type FilaHistorial } from "@/lib/leche";
import { huellaDeToken } from "@/lib/mcp/token";
import type { ContextoMcp, Datos } from "@/lib/mcp/herramientas";
import type { PlanId, RolFinca } from "@/lib/tipos";

export type Autenticado = { tokenId: string; userId: string; fincaId: string; ctx: ContextoMcp };
export type ResultadoAuth = { ok: true; auth: Autenticado } | { ok: false; estado: 401 | 403 | 503; motivo: string };

/** Cada cuánto se anota «último uso» (no en cada consulta). */
const REFRESCO_USO_MS = 5 * 60_000;

/**
 * Identifica al dueño del token y comprueba que sigue siendo miembro de esa finca y que la finca puede usar la app. El rol se lee de la base en cada
 * consulta: si lo cambian o lo sacan de la finca, el token deja de dar lo que daba (o deja de existir por la llave compuesta).
 */
export async function autenticar(token: string): Promise<ResultadoAuth> {
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
    auth: { tokenId: fila.id, userId: fila.user_id, fincaId: fila.finca_id, ctx: { fincaNombre: finca.nombre, rol: miembro.rol as RolFinca, plan: finca.plan as PlanId, hoy: hoyBogota(), moneda: finca.moneda } },
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
  const { secretKey } = leerEntorno();
  const como = <T,>(fn: Parameters<typeof conSesionDe<T>>[2]) => conSesionDe(auth.userId, secretKey!, fn);
  const { ctx, fincaId } = auth;
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
