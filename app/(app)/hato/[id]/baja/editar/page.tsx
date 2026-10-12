import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormSalida } from "@/components/FormSalida";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_TIPO_BAJA } from "@/lib/bajas";

export const metadata: Metadata = { title: "Corregir salida" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corregir los datos de la salida de un animal (comprador, peso, guía…) y volver a su ficha. */
export default async function PaginaCorregirSalida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  const { data: baja } = await supabase.from("bajas").select("*").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle();
  if (!baja) redirect(`/hato/${id}`);

  return (
    <>
      <Link href={`/hato/${id}#salida`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Corregir salida" subtitulo={`${etiquetaAnimal(animal)} · ${ETIQUETA_TIPO_BAJA[baja.tipo]} del ${formatoFecha(baja.fecha)}`} />
      <div className="lg:max-w-xl">
        <FormSalida baja={baja} />
      </div>
    </>
  );
}
