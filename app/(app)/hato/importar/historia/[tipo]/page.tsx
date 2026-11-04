import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { ImportarHistoria } from "@/components/ImportarHistoria";
import { obtenerContexto } from "@/lib/contexto";
import { TIPOS_HISTORIA, TITULO_HISTORIA, type TipoHistoria } from "@/lib/importar-historia";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";

export const metadata: Metadata = { title: "Cargar historia desde Excel" };

export default async function PaginaImportarHistoria({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS_HISTORIA.includes(tipo as TipoHistoria)) notFound();
  const t = tipo as TipoHistoria;
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, TITULO_HISTORIA[t].modulo, finca.plan)) redirect("/hato/migrar");

  return (
    <>
      <Link href="/hato/migrar" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Migrar mi finca
      </Link>
      <Encabezado titulo={`Cargar ${TITULO_HISTORIA[t].corto} desde Excel`} subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-3xl">
        <ImportarHistoria tipo={t} rutaVolver="/hato/migrar" puedeDeshacer={puedeGestionar(rol)} />
      </div>
    </>
  );
}
