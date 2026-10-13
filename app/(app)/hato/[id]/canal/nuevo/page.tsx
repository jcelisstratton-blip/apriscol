import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCanal } from "@/components/FormCanal";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Registrar canal" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La canal es de un animal sacrificado: se registra desde su ficha (Salida del hato) y vuelve a ella. */
export default async function PaginaCanalNueva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne", finca.plan)) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  const { data: baja } = await supabase.from("bajas").select("tipo, fecha, peso_kg, destino").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle();
  if (!baja || baja.tipo !== "sacrificio") redirect(`/hato/${id}`);
  const { data: existente } = await supabase.from("canales").select("id").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle();
  if (existente) redirect(`/carne/canales/${existente.id}`);

  return (
    <>
      <Link href={`/hato/${id}#salida`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Registrar canal" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormCanal animalId={id} hoy={hoyBogota()} fechaBaja={baja.fecha} pesoVivoInicial={baja.peso_kg} plantaInicial={baja.destino} solicitud={randomUUID()} />
      </div>
    </>
  );
}
