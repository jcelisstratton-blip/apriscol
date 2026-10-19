import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { ImportarAnimales } from "@/components/ImportarAnimales";
import { AYUDA_IMPORTAR } from "@/lib/ayuda";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Cargar animales desde Excel" };

export default async function PaginaImportarAnimales() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect("/hato");

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Cargar desde Excel" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-3xl">
        <AyudaModulo ayuda={AYUDA_IMPORTAR} />
        <ImportarAnimales rutaPlantilla="/hato/importar/plantilla" rutaHato="/hato" />
      </div>
    </>
  );
}
