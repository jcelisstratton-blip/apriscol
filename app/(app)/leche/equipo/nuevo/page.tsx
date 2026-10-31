import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormMantenimiento } from "@/components/FormMantenimiento";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { diasHasta, hoyBogota, sumarDias } from "@/lib/fechas";
import { ETIQUETA_MANTENIMIENTO } from "@/lib/leche-calidad";
import { Aviso } from "@/components/Aviso";

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Equipo de ordeño" };

export default async function PaginaEquipoNuevo({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const { de } = await searchParams;
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan)) redirect("/leche?vista=frio");

  // Desde un aviso de «Mantenimiento»: viene lo de la vez anterior y la próxima fecha se repite con el mismo intervalo.
  const hoy = hoyBogota();
  let base: { tipo: never; equipo: string | null; responsable: string | null; proxima_fecha: string | null } | undefined;
  let tarea: string | null = null;
  if (de && ID_UUID.test(de)) {
    const supabase = await crearClienteServidor();
    const { data: previo } = await supabase.from("mantenimiento_ordeno").select("tipo, equipo, responsable, fecha, proxima_fecha").eq("id", de).eq("finca_id", finca.id).maybeSingle();
    if (previo) {
      const intervalo = previo.proxima_fecha ? Math.max(1, diasHasta(previo.proxima_fecha, previo.fecha)) : null;
      base = { tipo: previo.tipo as never, equipo: previo.equipo, responsable: previo.responsable, proxima_fecha: intervalo ? sumarDias(hoy, intervalo) : null };
      tarea = `${ETIQUETA_MANTENIMIENTO[previo.tipo as keyof typeof ETIQUETA_MANTENIMIENTO] ?? previo.tipo}${previo.equipo ? ` · ${previo.equipo}` : ""}`;
    }
  }

  return (
    <>
      <Link href="/leche?vista=frio" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Equipo de ordeño" subtitulo="Lavados, vacío y revisiones" />
      <div className="space-y-4 lg:max-w-xl">
        {tarea ? <Aviso tipo="info">Registra que ya hiciste «{tarea}». Ajusta la fecha si no fue hoy y guarda: la próxima vez queda calculada.</Aviso> : null}
        <FormMantenimiento hoy={hoy} solicitud={randomUUID()} base={base} />
      </div>
    </>
  );
}
