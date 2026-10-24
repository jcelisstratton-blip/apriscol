import { NextResponse, type NextRequest } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { servicioEnPlan } from "@/lib/planes";
import { esReporteId } from "@/lib/reportes/catalogo";
import { construirLibroReporte, nombreArchivoReporte } from "@/lib/reportes/excel";
import { parametrosDe, prepararReporte } from "@/lib/reportes/servidor";
import { rangoPeriodo } from "@/lib/periodos";
import { respuestaExcel } from "@/lib/archivos";

export const dynamic = "force-dynamic";

/**
 * Descarga un reporte en Excel con los mismos filtros y periodo de la pantalla. Se arma en el servidor con la sesión de la persona (la base
 * decide qué ve) y con el mismo cálculo que la pantalla, así que el archivo y el listado siempre coinciden.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esReporteId(id)) return new NextResponse("Ese reporte no existe.", { status: 404 });
  const { finca } = await obtenerContexto();
  if (!servicioEnPlan(finca.plan, "reportes")) return new NextResponse("Descargar los reportes en Excel está en el plan Profesional.", { status: 403 });

  try {
    const listo = await prepararReporte(id, parametrosDe(Object.fromEntries(req.nextUrl.searchParams)), { completo: true });
    if (!listo) return new NextResponse("No tienes permiso para ver este reporte.", { status: 403 });
    const rango = listo.def.periodo ? rangoPeriodo(listo.fechas.periodo, listo.hoy, listo.fechas.desde, listo.fechas.hasta) : null;
    const libro = await construirLibroReporte({
      def: listo.def,
      finca: listo.finca.nombre,
      resultado: listo.resultado,
      periodo: listo.periodoTexto && rango ? { texto: listo.periodoTexto, desde: rango.desde, hasta: rango.hasta } : null,
      filtros: listo.filtrosTexto,
      hoy: listo.hoy,
      generado: new Date(),
    });
    const nombre = nombreArchivoReporte(listo.finca.nombre, listo.def.titulo, listo.hoy);
    return respuestaExcel(libro, nombre);
  } catch {
    return new NextResponse("No se pudo armar el reporte. Intenta de nuevo.", { status: 500 });
  }
}
