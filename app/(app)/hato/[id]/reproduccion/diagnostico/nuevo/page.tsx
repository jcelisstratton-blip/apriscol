import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormDiagnostico } from "@/components/FormDiagnostico";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Diagnóstico de gestación" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDiagnosticoNuevo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "reproduccion", finca.plan)) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, sexo, estado").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  if (animal.sexo !== "hembra" || animal.estado !== "activo") redirect(`/hato/${id}`);
  const { data: repro } = await supabase.from("v_repro_hembras").select("*").eq("animal_id", id).maybeSingle();
  // El servicio al que corresponde: el último, si es posterior al último parto.
  const servicio = repro?.servicio_id && repro.ultimo_servicio && (!repro.ultimo_parto || repro.ultimo_servicio > repro.ultimo_parto) ? { id: repro.servicio_id, fecha: repro.ultimo_servicio } : null;

  return (
    <>
      <Link href={`/hato/${id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Diagnóstico de gestación" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormDiagnostico hembraId={id} hoy={hoyBogota()} servicio={servicio} />
      </div>
    </>
  );
}
