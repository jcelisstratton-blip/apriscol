import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormFinca } from "@/components/FormFinca";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Especie } from "@/lib/tipos";

export const metadata: Metadata = { title: "Datos de la finca" };

export default async function PaginaEditarFinca() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) redirect("/mas");

  // Las especies con animales registrados no se pueden quitar de la finca.
  const supabase = await crearClienteServidor();
  const enUso: Especie[] = [];
  for (const especie of finca.especies) {
    const { count } = await supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("especie", especie).is("deleted_at", null);
    if ((count ?? 0) > 0) enUso.push(especie);
  }

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Datos de la finca" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormFinca
          finca={{ id: finca.id, nombre: finca.nombre, departamento: finca.departamento, municipio: finca.municipio, vereda: finca.vereda, proposito: finca.proposito, especies: finca.especies, logo_path: finca.logo_path }}
          especiesEnUso={enUso}
        />
      </div>
    </>
  );
}
