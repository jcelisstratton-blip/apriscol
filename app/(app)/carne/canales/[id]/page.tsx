import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormCanal } from "@/components/FormCanal";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarCanal } from "@/app/(app)/carne/actions";

export const metadata: Metadata = { title: "Editar canal" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarCanal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: canal } = await supabase.from("canales").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!canal) notFound();
  if (!puedeEscribir(rol, "carne")) redirect(`/hato/${canal.animal_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", canal.animal_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();

  return (
    <>
      <Link href={`/hato/${animal.id}#salida`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar canal" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormCanal animalId={animal.id} hoy={hoyBogota()} canal={canal as never} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar esta canal"
            resumen={`la canal del ${formatoFecha(canal.fecha)}`}
            accion={eliminarCanal.bind(null, id)}
            destino={`/hato/${animal.id}#salida`}
            mensaje="Canal eliminada"
          />
        ) : null}
      </div>
    </>
  );
}
