import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormPrueba } from "@/components/FormPrueba";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_PRUEBA_CORTA } from "@/lib/sanidad";
import { eliminarPrueba } from "@/app/(app)/sanidad/actions";

export const metadata: Metadata = { title: "Editar prueba" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarPrueba({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: prueba } = await supabase.from("pruebas_sanitarias").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!prueba) notFound();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect(`/hato/${prueba.animal_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", prueba.animal_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();

  return (
    <>
      <Link href={`/hato/${animal.id}#sanidad`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar prueba" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormPrueba animalId={animal.id} hoy={hoyBogota()} prueba={prueba} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar esta prueba"
            resumen={`${ETIQUETA_PRUEBA_CORTA[prueba.prueba]} del ${formatoFecha(prueba.fecha)}`}
            accion={eliminarPrueba.bind(null, id)}
            destino={`/hato/${animal.id}#sanidad`}
            mensaje="Prueba eliminada"
          />
        ) : null}
      </div>
    </>
  );
}
