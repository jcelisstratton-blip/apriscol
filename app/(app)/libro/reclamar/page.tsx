import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormReclamo } from "@/components/FormReclamo";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionar } from "@/lib/permisos";
import { formatoFecha } from "@/lib/fechas";

export const metadata: Metadata = { title: "Reclamar animales" };

const TONO = { pendiente: "aviso", aprobada: "ok", rechazada: "alerta", cancelada: "neutro" } as const;
const ETIQUETA = { pendiente: "En revisión", aprobada: "Aprobada", rechazada: "Rechazada", cancelada: "Cancelada" } as const;

export default async function PaginaReclamar() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) redirect("/hato");
  const supabase = await crearClienteServidor();
  const { data: solicitudes } = await supabase
    .from("solicitudes_reclamo")
    .select("id, estado, animales_disponibles, animales_importados, motivo_rechazo, created_at")
    .eq("finca_id", finca.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Reclamar animales" subtitulo={finca.nombre} />
      <div className="space-y-3.5">
        <p className="text-[0.9375rem] text-humo">
          Si tus animales están en el libro genealógico, escribe tu documento y los traemos a esta finca con su pedigrí, su
          registro y su microchip. Un administrador revisa cada solicitud antes de aprobarla.
        </p>
        <Tarjeta>
          <FormReclamo />
        </Tarjeta>

        {(solicitudes ?? []).length > 0 ? (
          <Tarjeta titulo="Tus solicitudes">
            <ul className="divide-y divide-arena">
              {(solicitudes ?? []).map((s) => (
                <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {s.animales_disponibles} {s.animales_disponibles === 1 ? "animal" : "animales"}
                    </span>
                    <span className="block text-sm text-humo">
                      {formatoFecha(s.created_at.slice(0, 10), { day: "numeric", month: "short" })}
                      {s.estado === "aprobada" && s.animales_importados != null ? ` · ${s.animales_importados} traídos` : ""}
                      {s.estado === "rechazada" && s.motivo_rechazo ? ` · ${s.motivo_rechazo}` : ""}
                    </span>
                  </span>
                  <Insignia tono={TONO[s.estado]}>{ETIQUETA[s.estado]}</Insignia>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
