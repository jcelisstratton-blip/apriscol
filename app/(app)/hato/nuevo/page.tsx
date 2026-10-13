import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormAnimal } from "@/components/FormAnimal";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Animal nuevo" };

export default async function PaginaAnimalNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect("/hato");
  const supabase = await crearClienteServidor();
  const { data: razas } = await supabase.from("razas").select("*").in("especie", finca.especies).order("nombre");

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Animal nuevo" subtitulo={finca.nombre} />
      <div className="lg:max-w-3xl">
        <FormAnimal fincaId={finca.id} especies={finca.especies} propositoFinca={finca.proposito} razas={razas ?? []} solicitud={randomUUID()} />
      </div>
    </>
  );
}
