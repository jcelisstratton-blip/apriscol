import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { ListaFerias } from "@/components/ListaFerias";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";

export const metadata: Metadata = { title: "Ferias y premios" };

export default async function PaginaFerias() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "ferias")) redirect("/");
  const puedeCrear = puedeEscribir(rol, "ferias");

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado
        titulo="Ferias"
        subtitulo={finca.nombre}
        acciones={
          puedeCrear ? (
            <Link href="/ferias/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
              <Plus className="size-4" strokeWidth={2.4} /> Nueva
            </Link>
          ) : null
        }
      />
      <ListaFerias fincaId={finca.id} puedeCrear={puedeCrear} />
    </>
  );
}
