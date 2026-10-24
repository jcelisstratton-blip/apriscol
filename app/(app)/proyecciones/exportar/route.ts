import { NextResponse, type NextRequest } from "next/server";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { respuestaExcel } from "@/lib/archivos";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeGestionar, puedeVer } from "@/lib/permisos";
import { cargarBase } from "@/lib/proyeccion/cargar";
import { construirLibroProyeccion, nombreArchivoProyeccion } from "@/lib/proyeccion/excel";
import { correr } from "@/lib/proyeccion/analisis";
import { aEscenario } from "@/lib/proyeccion/escenarios";
import { porAnio } from "@/lib/proyeccion/motor";
import { aplicarAjustes, HORIZONTE_DEFECTO, HORIZONTES, limpiarAjustes } from "@/lib/proyeccion/supuestos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Descarga la proyección que se está mirando en pantalla: el horizonte (`h`) y los ajustes (`a`) llegan en la dirección, se limpian aquí y se
 * calcula con el mismo simulador, así que el archivo y la pantalla siempre coinciden.
 */
export async function GET(req: NextRequest) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol) || !puedeVer(rol, "proyecciones", finca.plan)) return new NextResponse("No tienes permiso para ver las proyecciones.", { status: 403 });

  const horizonte = HORIZONTES.find((h) => h === Number(req.nextUrl.searchParams.get("h"))) ?? HORIZONTE_DEFECTO;
  let ajustes = {};
  try {
    ajustes = limpiarAjustes(JSON.parse(req.nextUrl.searchParams.get("a") ?? "{}"));
  } catch {
    return new NextResponse("Los ajustes de la proyección no se entendieron.", { status: 400 });
  }

  try {
    const supabase = await crearClienteServidor();
    const hoy = hoyBogota();
    const datos = await cargarBase(supabase, finca.id, hoy, await obtenerAjustes());
    const supuestos = aplicarAjustes(datos.base, ajustes);
    const entrada = { inicio: datos.inicio, horizonte, gestacionDias: datos.gestacionDias, estacion: datos.estacion };
    const proyeccion = correr(entrada, supuestos);
    const { data: guardados } = await supabase.from("proyecciones").select("id, nombre, horizonte_meses, ajustes").eq("finca_id", finca.id).order("created_at").limit(20);
    const libro = await construirLibroProyeccion({
      finca: finca.nombre,
      hoy,
      generado: new Date(),
      horizonte,
      proyeccion,
      bloques: porAnio(proyeccion),
      supuestos,
      ajustes,
      procedencia: datos.procedencia,
      base: datos.base,
      entrada,
      escenarios: (guardados ?? []).map(aEscenario),
    });
    return respuestaExcel(libro, nombreArchivoProyeccion(finca.nombre, hoy));
  } catch {
    return new NextResponse("No se pudo armar la proyección. Intenta de nuevo.", { status: 500 });
  }
}
