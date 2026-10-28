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

export const metadata: Metadata = { title: "Enviar una novedad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enviar una novedad sobre un animal (se llega desde su ficha): se eligen las opciones, no se escribe nada. */
export default async function PaginaNovedadNueva({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal } = await searchParams;
  if (!puedeEscribir(rol, "novedades", finca.plan)) redirect("/");
  if (!animal || !ID_UUID.test(animal)) redirect("/hato");
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("animales").select("id, numero_arete, nombre, estado").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  if (data.estado !== "activo") redirect(`/hato/${animal}`);
  const [{ data: productos }, { data: lotes }] = await Promise.all([
    supabase.from("productos_veterinarios").select("id, nombre, tipo").eq("finca_id", finca.id).eq("activo", true).order("nombre").limit(500),
    supabase.rpc("lotes_sanidad", { p_finca: finca.id }),
  ]);

  return (
    <>
      <Link href={`/hato/${animal}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {data.nombre ?? data.numero_arete}
      </Link>
      <Encabezado titulo="Enviar una novedad" subtitulo={etiquetaAnimal(data)} />
      <div className="lg:max-w-xl">
        <FormNovedad animalId={animal} animalTexto={etiquetaAnimal(data)} productos={(productos ?? []).map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo }))} lotes={lotes ?? []} solicitud={randomUUID()} />
      </div>
    </>
  );
}
