import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { VistaReporte } from "@/components/VistaReporte";
import { servicioEnPlan } from "@/lib/planes";
import { definicionReporte, esReporteId } from "@/lib/reportes/catalogo";
import { parametrosDe, prepararReporte } from "@/lib/reportes/servidor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: esReporteId(id) ? definicionReporte(id).titulo : "Reportes" };
}

/**
 * Un reporte. El listado y el Excel salen del mismo cálculo (`prepararReporte`), así que siempre dicen lo mismo.
 */
export default async function PaginaReporte({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!esReporteId(id)) notFound();
  const listo = await prepararReporte(id, parametrosDe(await searchParams));
  if (!listo) redirect("/reportes");

  return (
    <VistaReporte
      def={listo.def}
      resultado={listo.resultado}
      filtrosDef={listo.filtrosDef}
      filtros={listo.filtros}
      fechas={listo.fechas}
      fincaNombre={listo.finca.nombre}
      puedeExcel={servicioEnPlan(listo.finca.plan, "reportes")}
    />
  );
}
