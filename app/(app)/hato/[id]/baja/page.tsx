import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormBaja } from "@/components/FormBaja";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { etiquetaAnimal } from "@/lib/animal";

export const metadata: Metadata = { title: "Dar de baja" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaBaja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect(`/hato/${id}`);

  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase
    .from("animales")
    .select("id, numero_arete, nombre, sexo, estado, fecha_nacimiento")
    .eq("id", id)
    .eq("finca_id", finca.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!animal) notFound();
  if (animal.estado !== "activo") redirect(`/hato/${id}`);

  const { data: lactancia } =
    animal.sexo === "hembra"
      ? await supabase.from("lactancias").select("id").eq("animal_id", id).eq("finca_id", finca.id).is("fecha_secado", null).maybeSingle()
      : { data: null };

  return (
    <>
      <Link href={`/hato/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Dar de baja" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormBaja animalId={id} etiqueta={etiquetaAnimal(animal)} hoy={hoyBogota()} nacimiento={animal.fecha_nacimiento} enOrdeno={Boolean(lactancia)} />
      </div>
    </>
  );
}
