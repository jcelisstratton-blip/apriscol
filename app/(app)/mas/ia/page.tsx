import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConectarClaude } from "@/components/ConectarClaude";
import { ConexionIa } from "@/components/ConexionIa";
import { Encabezado } from "@/components/Encabezado";
import { obtenerContexto } from "@/lib/contexto";
import { SITE_URL } from "@/lib/env";
import { fechaHoraBogota } from "@/lib/fechas";
import { rutaMcp } from "@/lib/mcp/conexion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conexión con IA" };

/**
 * Conexión con IA: la persona deja que su asistente (Claude) consulte su finca, solo para leer. La vía normal es conectar Claude con su inicio de sesión
 * (OAuth); el token personal queda como opción avanzada (Claude Code y otros). Ve y quita sus propios permisos.
 */
export default async function PaginaIa() {
  const { finca, user } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  // Nunca se trae la huella: la pantalla no la necesita. Si el servidor OAuth no está activo, la lista de permisos sale vacía.
  const [{ data }, grants] = await Promise.all([
    supabase.from("tokens_ia").select("id, nombre, prefijo, creado_en, ultimo_uso").eq("finca_id", finca.id).eq("user_id", user.id).is("revocado_en", null).order("creado_en", { ascending: false }).limit(10),
    supabase.auth.oauth.listGrants().catch(() => ({ data: null })),
  ]);

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Conexión con IA" subtitulo="Pregúntale a Claude por tu finca" />
      <div className="space-y-4 lg:max-w-xl">
        <ConectarClaude
          finca={finca.nombre}
          url={rutaMcp(SITE_URL)}
          // Las fechas se escriben aquí, en el servidor: si el navegador las formateara, «p. m.» no saldría igual y React tendría que rehacer la pantalla.
          apps={(grants.data ?? []).map((g) => ({ clientId: g.client.id, nombre: g.client.name || "Asistente de IA", desde: fechaHoraBogota(g.granted_at) }))}
        />
        <details className="rounded-3xl bg-papel ring-1 ring-arena">
          <summary className="min-h-12 cursor-pointer list-none px-4 py-3.5 text-[0.9375rem] font-semibold">Opciones avanzadas: código personal (Claude Code y otros)</summary>
          <div className="px-4 pb-4">
            <ConexionIa
              finca={finca.nombre}
              conexiones={(data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, prefijo: c.prefijo, creada: fechaHoraBogota(c.creado_en), ultimoUso: c.ultimo_uso ? fechaHoraBogota(c.ultimo_uso) : null }))}
            />
          </div>
        </details>
      </div>
    </>
  );
}
