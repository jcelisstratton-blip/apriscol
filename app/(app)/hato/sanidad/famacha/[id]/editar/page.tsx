import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormFamacha } from "@/components/FormFamacha";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarFamacha } from "@/app/(app)/sanidad/actions";

export const metadata: Metadata = { title: "Editar evaluación FAMACHA" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarFamacha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: evaluacion } = await supabase.from("evaluaciones_famacha").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!evaluacion) notFound();
  if (!puedeEscribir(rol, "sanidad")) redirect(`/hato/${evaluacion.animal_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", evaluacion.animal_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();

  return (
    <>
      <Link href={`/hato/${animal.id}#sanidad`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar evaluación FAMACHA" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormFamacha animalId={animal.id} hoy={hoyBogota()} evaluacion={evaluacion} />
        <EliminarRegistro
          etiqueta="Eliminar esta evaluación"
          resumen={`FAMACHA ${evaluacion.puntaje} del ${formatoFecha(evaluacion.fecha)}`}
          accion={eliminarFamacha.bind(null, id)}
          destino={`/hato/${animal.id}#sanidad`}
          mensaje="Evaluación eliminada"
        />
      </div>
    </>
  );
}
