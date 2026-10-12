import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormParto } from "@/components/FormParto";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarParto } from "@/app/(app)/reproduccion/actions";

export const metadata: Metadata = { title: "Editar parto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarParto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: parto } = await supabase.from("partos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!parto) notFound();
  if (!puedeEscribir(rol, "reproduccion")) redirect(`/hato/${parto.madre_id}`);
  const [{ data: animal }, { data: crias }] = await Promise.all([
    supabase.from("animales").select("id, numero_arete, nombre").eq("id", parto.madre_id).eq("finca_id", finca.id).maybeSingle(),
    supabase.from("crias").select("*").eq("parto_id", id).eq("finca_id", finca.id).order("created_at"),
  ]);
  if (!animal) notFound();

  return (
    <>
      <Link href={`/hato/${animal.id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar parto" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormParto hembraId={animal.id} hoy={hoyBogota()} parto={parto} crias={crias ?? []} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este parto"
            resumen={`el parto del ${formatoFecha(parto.fecha)}`}
            consecuencia="Se eliminan también sus crías registradas y la lactancia que abrió (si todavía no tiene ordeños). Los animales que se crearon desde las crías no se tocan"
            accion={eliminarParto.bind(null, id)}
            destino={`/hato/${animal.id}#reproduccion`}
            mensaje="Parto eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
