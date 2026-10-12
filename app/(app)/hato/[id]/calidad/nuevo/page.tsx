import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCalidad } from "@/components/FormCalidad";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Análisis de leche" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El análisis de la leche de un animal se registra desde su ficha y vuelve a ella. */
export default async function PaginaCalidadAnimal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, sexo, estado").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  // Solo las hembras dan leche, y un animal que ya salió del hato no recibe registros nuevos.
  if (animal.sexo !== "hembra" || animal.estado !== "activo") redirect(`/hato/${id}`);

  return (
    <>
      <Link href={`/hato/${id}#calidad`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Análisis de leche" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormCalidad hoy={hoyBogota()} animalId={id} solicitud={randomUUID()} cancelar={`/hato/${id}#calidad`} />
      </div>
    </>
  );
}
