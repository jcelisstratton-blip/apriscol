import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormFrio } from "@/components/FormFrio";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Medir temperatura" };

export default async function PaginaFrioNuevo() {
  const { rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) redirect("/leche?vista=frio");

  return (
    <>
      <Link href="/leche?vista=frio" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Medir temperatura" subtitulo="Cadena de frío de la leche" />
      <div className="lg:max-w-xl">
        <FormFrio hoy={hoyBogota()} solicitud={randomUUID()} />
      </div>
    </>
  );
}
