import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormNovedad } from "@/components/FormNovedad";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";

export const metadata: Metadata = { title: "Crear una novedad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enviar una novedad sobre un animal (se llega desde su ficha): se eligen las opciones, no se escribe nada. */
export default async function PaginaNovedadNueva({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal } = await searchParams;
  if (!puedeEscribir(rol, "novedades", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  // Con un animal (desde su ficha) viene elegido; sin él (desde Sanidad) se elige en el formulario.
  let data: { id: string; numero_arete: string; nombre: string | null; estado: string } | null = null;
  if (animal) {
    if (!ID_UUID.test(animal)) notFound();
    const r = await supabase.from("animales").select("id, numero_arete, nombre, estado").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
    data = r.data;
    if (!data) notFound();
    if (data.estado !== "activo") redirect(`/hato/${animal}`);
  }
  return (
    <>
      <Link href={data ? `/hato/${data.id}` : "/novedades"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {data ? (data.nombre ?? data.numero_arete) : "Novedades"}
      </Link>
      <Encabezado titulo="Crear una novedad" subtitulo={data ? etiquetaAnimal(data) : finca.nombre} />
      <div className="lg:max-w-xl">
        <FormNovedad animalId={data?.id} animalTexto={data ? etiquetaAnimal(data) : undefined} fincaId={finca.id} solicitud={randomUUID()} />
      </div>
    </>
  );
}
