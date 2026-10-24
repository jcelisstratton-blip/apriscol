import { PassThrough, Readable } from "node:stream";
import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyBogota } from "@/lib/fechas";
import { nombreArchivoFinca } from "@/lib/exportar-finca";
import { escribirExportacion, type ClienteExportar } from "@/lib/exportar-finca-excel";
import { cabecerasExcel } from "@/lib/archivos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Descarga todos los datos de la finca activa en un Excel (una hoja por tema). Solo el propietario: incluye personal y pagos. Se arma con su sesión,
 * así que la base decide qué puede ver, y se envía a medida que se escribe, sin tener el libro entero en memoria.
 */
export async function GET() {
  const { finca, rol, user } = await obtenerContexto();
  if (rol !== "propietario") return new NextResponse("Solo el propietario de la finca puede exportar sus datos.", { status: 403 });

  const supabase = await crearClienteServidor();
  const salida = new PassThrough();
  void escribirExportacion({
    cliente: supabase as unknown as ClienteExportar,
    finca: { id: finca.id, nombre: finca.nombre },
    salida,
    generadoPor: user.email ?? undefined,
  }).catch((e) => salida.destroy(e instanceof Error ? e : new Error("No se pudo armar el archivo.")));

  const nombre = nombreArchivoFinca(finca.nombre, hoyBogota());
  return new Response(Readable.toWeb(salida) as ReadableStream, { headers: cabecerasExcel(nombre) });
}
