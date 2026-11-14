import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { Tutoriales } from "@/components/Tutoriales";

export const metadata: Metadata = { title: "Tutoriales" };

/** Los tutoriales en video de Apriscol (la lista vive en `lib/tutoriales.ts`). Es la misma para todos los roles y planes: no lee datos de la finca. */
export default function PaginaTutoriales() {
  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Tutoriales" subtitulo="Aprende Apriscol paso a paso, en video" />
      <Tutoriales />
    </>
  );
}
