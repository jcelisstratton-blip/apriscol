import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormPeso } from "@/components/FormPeso";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { kg } from "@/lib/carne";
import { eliminarPesaje } from "@/app/(app)/carne/actions";

export const metadata: Metadata = { title: "Editar peso" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un peso se corrige desde la ficha del animal (o desde Carne → Pesos) y vuelve a la ficha. */
export default async function PaginaEditarPeso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: pesaje } = await supabase.from("pesajes").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!pesaje) notFound();
  if (!puedeEscribir(rol, "carne", finca.plan)) redirect(`/hato/${pesaje.animal_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", pesaje.animal_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();

  return (
    <>
      <Link href={`/hato/${animal.id}#crecimiento`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar peso" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormPeso animalId={animal.id} hoy={hoyBogota()} pesaje={pesaje} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este peso"
            resumen={`el peso de ${kg(pesaje.peso_kg)} del ${formatoFecha(pesaje.fecha)}`}
            accion={eliminarPesaje.bind(null, id)}
            destino={`/hato/${animal.id}#crecimiento`}
            mensaje="Peso eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
