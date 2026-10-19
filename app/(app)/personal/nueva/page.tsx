import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormPersona } from "@/components/FormPersona";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Agregar personal" };

/** Agregar a una persona que trabaja en la finca, con su contrato y lo que se le paga. */
export default async function PaginaPersonaNueva() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/personal?vista=personas");
  return (
    <>
      <Link href="/personal?vista=personas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Personal
      </Link>
      <Encabezado titulo="Agregar personal" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormPersona hoy={hoyBogota()} />
      </div>
    </>
  );
}
