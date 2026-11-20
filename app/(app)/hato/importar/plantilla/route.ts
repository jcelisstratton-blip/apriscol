import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { plantillaAnimalesDeFinca } from "@/lib/importar-animales-servidor";
import { respuestaExcel } from "@/lib/archivos";

export const dynamic = "force-dynamic";

/** Descarga la plantilla de Excel para cargar animales: con las razas y especies de esta finca en los desplegables. */
export async function GET() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return new NextResponse("No tienes permiso para registrar animales en esta finca.", { status: 403 });
  const archivo = await plantillaAnimalesDeFinca(await crearClienteServidor(), finca, rol);
  if (!archivo) return new NextResponse("No se pudo preparar la plantilla. Inténtalo de nuevo.", { status: 500 });
  return respuestaExcel(archivo, "Plantilla de animales - Apriscol.xlsx");
}
