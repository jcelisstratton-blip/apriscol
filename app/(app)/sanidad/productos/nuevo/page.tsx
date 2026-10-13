import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormProducto } from "@/components/FormProducto";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Producto nuevo" };

export default async function PaginaProductoNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect("/sanidad?vista=productos");
  return (
    <>
      <Link href="/sanidad?vista=productos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Productos
      </Link>
      <Encabezado titulo="Producto nuevo" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormProducto />
      </div>
    </>
  );
}
