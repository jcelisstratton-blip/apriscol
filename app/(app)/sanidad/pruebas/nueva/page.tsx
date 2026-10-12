import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormPrueba } from "@/components/FormPrueba";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Prueba diagnóstica" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Una prueba es de un animal: se registra desde su ficha. Sin animal no hay a quién asignársela. */
export default async function PaginaPruebaNueva({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal } = await searchParams;
  if (!animal || !ID_UUID.test(animal)) redirect("/hato");
  if (!puedeEscribir(rol, "sanidad")) redirect(`/hato/${animal}`);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <Link href={`/hato/${animal}#sanidad`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {data.nombre ?? data.numero_arete}
      </Link>
      <Encabezado titulo="Prueba diagnóstica" subtitulo={etiquetaAnimal(data)} />
      <div className="lg:max-w-xl">
        <FormPrueba animalId={animal} hoy={hoyBogota()} solicitud={randomUUID()} />
      </div>
    </>
  );
}
