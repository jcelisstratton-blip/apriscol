import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { HistorialImportaciones, type CargueVista } from "@/components/HistorialImportaciones";
import { ImportarAnimales } from "@/components/ImportarAnimales";
import { Tarjeta } from "@/components/Tarjeta";
import { AYUDA_IMPORTAR } from "@/lib/ayuda";
import { obtenerContexto } from "@/lib/contexto";
import { columnasDePlantilla } from "@/lib/importar-animales-excel";
import { opcionesImportar } from "@/lib/importar-animales-servidor";
import type { ColumnaId } from "@/lib/importar-animales";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cargar animales desde Excel" };

/** Cuántos cargues recientes se listan (el historial es para deshacer un error reciente, no un archivo). */
const CARGUES_RECIENTES = 50;

export default async function PaginaImportarAnimales() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect("/hato");

  const supabase = await crearClienteServidor();
  const opciones = await opcionesImportar(supabase, finca, rol);
  // Los datos que se pueden cargar: los de la plantilla de esta finca (según plan y rol) y el estado, que solo sirve para saltar a los dados de baja.
  const campos: ColumnaId[] = [...columnasDePlantilla({ reproduccion: opciones.reproduccion, ubicaciones: opciones.ubicaciones }).map((c) => c.id as ColumnaId), "estado"];

  const { data } = await supabase
    .from("importaciones")
    .select("id, tipo, archivo, modo, creados, actualizados, estado, created_at")
    .eq("finca_id", finca.id)
    .order("created_at", { ascending: false })
    .limit(CARGUES_RECIENTES);
  const cargues = (data ?? []) as CargueVista[];
  const puedeDeshacer = puedeGestionar(rol);

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Cargar desde Excel" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-3xl">
        <AyudaModulo ayuda={AYUDA_IMPORTAR} />
        <Link href="/hato/migrar" className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo">
          Ver todos los pasos para migrar mi finca <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <ImportarAnimales rutaPlantilla="/hato/importar/plantilla" rutaHato="/hato" camposDisponibles={campos} puedeDeshacer={puedeDeshacer} />
        {cargues.length > 0 ? (
          <Tarjeta titulo="Cargues anteriores">
            <HistorialImportaciones cargues={cargues} puedeDeshacer={puedeDeshacer} />
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
