import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConectarClaude } from "@/components/ConectarClaude";
import { Encabezado } from "@/components/Encabezado";
import { obtenerContexto } from "@/lib/contexto";
import { SITE_URL } from "@/lib/env";
import { fechaHoraBogota } from "@/lib/fechas";
import { rutaMcp } from "@/lib/mcp/conexion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conexión con IA" };

/** Conexión con IA: la persona deja que Claude consulte su finca, solo para leer. Conecta con su inicio de sesión (OAuth) y ve y quita sus propios permisos. */
export default async function PaginaIa() {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  // Si el servidor OAuth no está activo, la lista de permisos sale vacía y se ven los pasos.
  const grants = await supabase.auth.oauth.listGrants().catch(() => ({ data: null }));

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Conexión con IA" subtitulo="Pregúntale a Claude por tu finca" />
      <div className="lg:max-w-xl">
        <ConectarClaude
          finca={finca.nombre}
          url={rutaMcp(SITE_URL)}
          // Las fechas se escriben aquí, en el servidor: si el navegador las formateara, «p. m.» no saldría igual y React tendría que rehacer la pantalla.
          apps={(grants.data ?? []).map((g) => ({ clientId: g.client.id, nombre: g.client.name || "Asistente de IA", desde: fechaHoraBogota(g.granted_at) }))}
        />
      </div>
    </>
  );
}
