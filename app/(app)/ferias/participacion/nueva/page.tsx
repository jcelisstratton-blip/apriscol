import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormParticipacion } from "@/components/FormParticipacion";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";

export const metadata: Metadata = { title: "Premio de feria" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El premio se registra desde la ficha del animal: sin animal no hay a quién asignárselo. */
export default async function PaginaParticipacionNueva({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal } = await searchParams;
  if (!animal || !ID_UUID.test(animal)) redirect("/hato");
  if (!puedeEscribir(rol, "ferias", finca.plan)) redirect(`/hato/${animal}`);
  const supabase = await crearClienteServidor();

  const [{ data: ferias }, { data: datosAnimal }] = await Promise.all([
    supabase.from("ferias").select("id, nombre, fecha_inicio").eq("finca_id", finca.id).order("fecha_inicio", { ascending: false }).limit(100),
    supabase.from("animales").select("id, numero_arete, nombre, estado").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle(),
  ]);
  if (!datosAnimal) notFound();
  if (datosAnimal.estado !== "activo") redirect(`/hato/${animal}`);

  return (
    <>
      <Link href={`/hato/${animal}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {datosAnimal.nombre ?? datosAnimal.numero_arete}
      </Link>
      <Encabezado titulo="Premio de feria" subtitulo={etiquetaAnimal(datosAnimal)} />
      <div className="lg:max-w-xl">
        <FormParticipacion ferias={ferias ?? []} animal={datosAnimal} solicitud={randomUUID()} />
      </div>
    </>
  );
}
