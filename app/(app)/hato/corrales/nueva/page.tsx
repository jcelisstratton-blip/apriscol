import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormUbicacion } from "@/components/FormUbicacion";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Nueva instalación" };

/** Un corral o un potrero se crea desde Hato → Corrales y vuelve a él. */
export default async function PaginaUbicacionNueva() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales", finca.plan)) redirect("/hato?vista=corrales");
  return (
    <>
      <Link href="/hato?vista=corrales" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Nueva instalación" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormUbicacion volver="/hato?vista=corrales" />
      </div>
    </>
  );
}
