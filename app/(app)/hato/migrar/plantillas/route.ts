import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { plantillaAnimalesDeFinca } from "@/lib/importar-animales-servidor";
import { construirPlantillaHistoria } from "@/lib/importar-historia-excel";
import { NOMBRE_LEAME, nombreEnZip, nombreZip, plantillasDisponibles, textoLeame, type TipoPlantilla } from "@/lib/plantillas-campo";
import { armarZip } from "@/lib/zip";
import { respuestaZip } from "@/lib/archivos";

export const dynamic = "force-dynamic";

/**
 * «Llevar las plantillas al campo»: todas las plantillas de cargue que esta persona puede usar, con las listas de su finca, en un solo .zip
 * con un «Léeme». Se descarga con señal y se llena sin ella; se carga al volver la conexión (ver `docs/modulos/sin-senal.md`).
 */
export async function GET() {
  const { finca, rol } = await obtenerContexto();
  const tipos = plantillasDisponibles(rol, finca.plan);
  if (tipos.length === 0) return new NextResponse("No tienes permiso para cargar datos en esta finca.", { status: 403 });

  const supabase = await crearClienteServidor();
  const construir = (t: TipoPlantilla) => (t === "animales" ? plantillaAnimalesDeFinca(supabase, finca, rol) : construirPlantillaHistoria(t, finca.nombre));
  const libros = await Promise.all(tipos.map(construir));
  if (libros.some((l) => !l)) return new NextResponse("No se pudieron preparar las plantillas. Inténtalo de nuevo.", { status: 500 });

  const zip = armarZip([
    { nombre: NOMBRE_LEAME, datos: textoLeame(finca.nombre, tipos) },
    ...tipos.map((t, i) => ({ nombre: nombreEnZip(t, i), datos: libros[i]! })),
  ]);
  return respuestaZip(zip, nombreZip(finca.nombre));
}
