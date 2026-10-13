import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormMantenimiento } from "@/components/FormMantenimiento";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Equipo de ordeño" };

export default async function PaginaEquipoNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan)) redirect("/leche?vista=frio");

  return (
    <>
      <Link href="/leche?vista=frio" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Equipo de ordeño" subtitulo="Lavados, vacío y revisiones" />
      <div className="lg:max-w-xl">
        <FormMantenimiento hoy={hoyBogota()} solicitud={randomUUID()} />
      </div>
    </>
  );
}
