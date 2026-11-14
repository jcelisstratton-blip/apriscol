import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { Tutoriales } from "@/components/Tutoriales";
import { numeroDeEnlace } from "@/lib/tutoriales";

export const metadata: Metadata = { title: "Tutoriales" };

/**
 * Los tutoriales en video de Apriscol (la lista vive en `lib/tutoriales.ts`). Es la misma para todos los roles y planes: no lee datos de la finca.
 * Con `?ver=N` se abre directo ese video (así llegan el aviso de Hoy y el botón «Míralo en video» de las ayudas).
 */
export default async function PaginaTutoriales({ searchParams }: { searchParams: Promise<{ ver?: string | string[] }> }) {
  const { ver } = await searchParams;
  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Tutoriales" subtitulo="Aprende Apriscol paso a paso, en video" />
      <Tutoriales abrirNumero={numeroDeEnlace(ver)} />
    </>
  );
}
