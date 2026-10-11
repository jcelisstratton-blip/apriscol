import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormFeria } from "@/components/FormFeria";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Feria nueva" };

export default async function PaginaFeriaNueva({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) redirect("/ferias");
  const { animal } = await searchParams;
  const animalId = animal && /^[0-9a-f-]{36}$/i.test(animal) ? animal : undefined;

  return (
    <>
      <Link href="/ferias" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Ferias
      </Link>
      <Encabezado titulo="Feria nueva" />
      <FormFeria animalId={animalId} />
    </>
  );
}
