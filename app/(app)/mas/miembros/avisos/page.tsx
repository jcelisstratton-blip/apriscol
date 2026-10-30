import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisosPersona } from "@/components/AvisosPersona";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { obtenerContexto } from "@/lib/contexto";
import type { EstadoVinculo } from "@/lib/notificaciones/enlace";
import { horaCorta } from "@/lib/notificaciones/parametros";
import { ETIQUETA_ROL, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { RolFinca } from "@/lib/tipos";
import { guardarAvisosEquipo } from "./actions";

export const metadata: Metadata = { title: "Avisos del equipo" };

/** Propietario y administrador: cuándo y qué recibe cada persona de la finca por Telegram. Cada persona conecta su propio Telegram y puede pausarlo o desconectarlo. */
export default async function PaginaAvisosEquipo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) redirect("/mas");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("equipo_notificaciones", { p_finca: finca.id });
  const personas = data ?? [];

  return (
    <>
      <Link href="/mas/miembros" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Equipo
      </Link>
      <Encabezado titulo="Avisos del equipo" subtitulo="Qué reciben por Telegram" />
      <div className="space-y-3 lg:max-w-2xl">
        <Aviso tipo="info">Cada persona conecta su propio Telegram desde Más → Telegram. Recibe lo que actives aquí; puede pausarlo o desconectarlo cuando quiera.</Aviso>
        {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
        {!error && personas.length === 0 ? (
          <EstadoVacio icono={<Users />} titulo="Todavía no hay equipo" descripcion="Cuando invites a alguien, aquí aparecerá para fijar sus avisos." />
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {personas.map((p) => (
              <li key={p.user_id} className="min-w-0">
                <AvisosPersona
                  guardar={guardarAvisosEquipo}
                  fincaId={finca.id}
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
      </div>
    </>
  );
}
