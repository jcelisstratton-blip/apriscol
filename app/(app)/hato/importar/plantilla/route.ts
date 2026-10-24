import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { opcionesImportar } from "@/lib/importar-animales-servidor";
import { construirPlantillaAnimales } from "@/lib/importar-animales-excel";
import type { RazaRef } from "@/lib/importar-animales";
import { respuestaExcel } from "@/lib/archivos";

export const dynamic = "force-dynamic";

/** Descarga la plantilla de Excel para cargar animales: con las razas y especies de esta finca en los desplegables. */
export async function GET() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return new NextResponse("No tienes permiso para registrar animales en esta finca.", { status: 403 });
  const supabase = await crearClienteServidor();
  const { data: razas } = await supabase.from("razas").select("id, especie, nombre").in("especie", finca.especies).order("nombre");
  const opciones = await opcionesImportar(supabase, finca, rol);
  if (opciones.error) return new NextResponse("No se pudo preparar la plantilla. Inténtalo de nuevo.", { status: 500 });
  const archivo = await construirPlantillaAnimales({
    finca: finca.nombre,
    especies: finca.especies,
    razas: (razas ?? []) as RazaRef[],
    reproduccion: opciones.reproduccion,
    ubicaciones: opciones.ubicaciones,
  });
  return respuestaExcel(archivo, "Plantilla de animales - Apriscol.xlsx");
}
