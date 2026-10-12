import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCalidad } from "@/components/FormCalidad";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Análisis de calidad" };

export default async function PaginaCalidadNuevo() {
  const { rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) redirect("/leche?vista=calidad");

  return (
    <>
      <Link href="/leche?vista=calidad" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Análisis de calidad" subtitulo="Leche del tanque o del lote" />
      <div className="lg:max-w-xl">
        <FormCalidad hoy={hoyBogota()} solicitud={randomUUID()} cancelar="/leche?vista=calidad" />
      </div>
    </>
  );
}
