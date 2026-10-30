import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisosPersona } from "@/components/AvisosPersona";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { guardarAvisos } from "./actions";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { RolFinca } from "@/lib/tipos";
import { horaCorta } from "@/lib/notificaciones/parametros";
import type { EstadoVinculo } from "@/lib/notificaciones/enlace";

export const metadata: Metadata = { title: "Avisos por Telegram" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El superadmin fija, persona por persona, cuándo y qué recibe de la finca por Telegram. Las personas solo conectan su cuenta. */
export default async function PaginaAvisosFinca({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_notificaciones", { p_finca: id });
  const { data: ficha } = await supabase.rpc("admin_ficha_finca", { p_finca: id });
  if (!error && !ficha) notFound();
  const personas = data ?? [];

  return (
    <>
      <Link href={`/admin/fincas/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {ficha?.finca.nombre ?? "Finca"}
      </Link>
      <Encabezado titulo="Avisos por Telegram" subtitulo="Cuándo y qué recibe cada persona" />
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {!error && personas.length === 0 ? (
        <EstadoVacio icono={<Users />} titulo="Esta finca no tiene equipo" descripcion="Cuando tenga personas, aquí aparecerán para fijar sus avisos." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:max-w-2xl">
          {personas.map((p) => (
            <li key={p.user_id} className="min-w-0">
              <AvisosPersona
                guardar={guardarAvisos}
                conMaximo
                fincaId={id}
                userId={p.user_id}
                nombre={p.nombre || p.email}
                correo={p.email}
                rol={ETIQUETA_ROL[p.rol as RolFinca] ?? p.rol}
                vinculo={p.vinculo as EstadoVinculo}
                inicial={{
                  activo: p.activo,
                  resumen: p.resumen,
                  resumen_hora: horaCorta(p.resumen_hora),
                  dias: p.dias,
                  nivel_minimo: p.nivel_minimo === "rojo" ? "rojo" : "ambar",
                  alertas: p.alertas,
                  semanal: p.semanal,
                  silencio_desde: horaCorta(p.silencio_desde),
                  silencio_hasta: horaCorta(p.silencio_hasta),
                  max_diarios: p.max_diarios,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
