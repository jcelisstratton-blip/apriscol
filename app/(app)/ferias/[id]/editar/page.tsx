import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarFeria } from "@/components/EliminarFeria";
import { Encabezado } from "@/components/Encabezado";
import { FormFeria } from "@/components/FormFeria";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Editar feria" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarFeria({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) redirect(`/ferias/${id}`);

  const supabase = await crearClienteServidor();
  const { data: feria } = await supabase.from("ferias").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!feria) notFound();
  const { count } = await supabase.from("participaciones_feria").select("id", { count: "exact", head: true }).eq("feria_id", id).eq("finca_id", finca.id);

  return (
    <>
      <Link href={`/ferias/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {feria.nombre}
      </Link>
      <Encabezado titulo="Editar feria" subtitulo={feria.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormFeria
          feria={{
            id: feria.id,
            nombre: feria.nombre,
            nivel: feria.nivel,
            departamento: feria.departamento,
            municipio: feria.municipio,
            fecha_inicio: feria.fecha_inicio,
            fecha_fin: feria.fecha_fin,
            organizador: feria.organizador,
          }}
        />
        <div className="border-t border-arena pt-5">
          <EliminarFeria feriaId={feria.id} nombre={feria.nombre} participaciones={count ?? 0} />
        </div>
      </div>
    </>
  );
}
