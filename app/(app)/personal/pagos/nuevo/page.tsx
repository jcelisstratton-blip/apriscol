import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormPagoPersonal } from "@/components/FormPagoPersonal";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Persona } from "@/lib/tipos";

export const metadata: Metadata = { title: "Registrar un pago" };

/** Registrar un pago al personal: se elige la persona y el valor viene de su contrato. */
export default async function PaginaPagoNuevo({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/mas/miembros?vista=pagos");
  const sp = await searchParams;
  const supabase = await crearClienteServidor();
  const [{ data }, ajustes] = await Promise.all([
    supabase.from("personal").select("*").eq("finca_id", finca.id).eq("activo", true).order("nombre"),
    obtenerAjustes(),
  ]);
  const personal = (data ?? []) as Persona[];
  if (personal.length === 0) redirect("/mas/miembros");

  return (
    <>
      <Link href="/mas/miembros?vista=pagos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Equipo
      </Link>
      <Encabezado titulo="Registrar un pago" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormPagoPersonal hoy={hoyBogota()} personal={personal} factor={Number(ajustes.general.factor_prestacional)} solicitud={randomUUID()} personaInicial={personal.some((p) => p.id === sp.persona) ? sp.persona : undefined} />
      </div>
    </>
  );
}
