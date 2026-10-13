import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormUbicacion } from "@/components/FormUbicacion";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Editar instalación" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaUbicacionEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales", finca.plan)) redirect(`/hato/corrales/${id}`);
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.from("ubicaciones").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!u) notFound();
  const { count: ocupantes } = await supabase.from("movimientos_animales").select("id", { count: "exact", head: true }).eq("ubicacion_id", id).is("hasta", null);
  return (
    <>
      <Link href={`/hato/corrales/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {u.nombre}
      </Link>
      <Encabezado titulo="Editar instalación" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormUbicacion ubicacion={u} volver={`/hato/corrales/${id}`} ocupantes={ocupantes ?? 0} />
      </div>
    </>
  );
}
