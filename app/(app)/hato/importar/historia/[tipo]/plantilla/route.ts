import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { construirPlantillaHistoria } from "@/lib/importar-historia-excel";
import { TIPOS_HISTORIA, TITULO_HISTORIA, type TipoHistoria } from "@/lib/importar-historia";
import { respuestaExcel } from "@/lib/archivos";

export const dynamic = "force-dynamic";

/** Descarga la plantilla de Excel del cargue de historia (pesajes, ordeños o sanidad): opcional, el cargue también acepta el Excel propio. */
export async function GET(_: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS_HISTORIA.includes(tipo as TipoHistoria)) return new NextResponse("Ese cargue no existe.", { status: 404 });
  const t = tipo as TipoHistoria;
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, TITULO_HISTORIA[t].modulo, finca.plan)) return new NextResponse("No tienes permiso para registrar esto en esta finca.", { status: 403 });
  const archivo = await construirPlantillaHistoria(t, finca.nombre);
  return respuestaExcel(archivo, `Plantilla de ${TITULO_HISTORIA[t].corto} - Apriscol.xlsx`);
}
