import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormCalidad } from "@/components/FormCalidad";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { etiquetaAnimal } from "@/lib/animal";
import { eliminarAnalisis } from "@/app/(app)/leche/gestion";

export const metadata: Metadata = { title: "Editar análisis" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: registro } = await supabase.from("analisis_leche").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!registro) notFound();
  if (!puedeEscribir(rol, "leche")) redirect(registro.animal_id ? `/hato/${registro.animal_id}` : "/leche?vista=calidad");
  // Un análisis de un animal se corrige desde su ficha y vuelve a ella.
  const animal = registro.animal_id
    ? (await supabase.from("animales").select("id, numero_arete, nombre").eq("id", registro.animal_id).eq("finca_id", finca.id).maybeSingle()).data
    : null;
  if (registro.animal_id && !animal) notFound();
  const volver = animal ? `/hato/${animal.id}#calidad` : "/leche?vista=calidad";

  return (
    <>
      <Link href={volver} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal ? (animal.nombre ?? animal.numero_arete) : "Leche"}
      </Link>
      <Encabezado titulo="Editar análisis" subtitulo={animal ? etiquetaAnimal(animal) : (registro.muestra ?? "Leche mezclada")} />
      <div className="space-y-8 lg:max-w-xl">
        <FormCalidad hoy={hoyBogota()} analisis={registro as never} cancelar={volver} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este análisis"
            resumen={`el análisis del ${formatoFecha(registro.fecha)}`}
            accion={eliminarAnalisis.bind(null, id)}
            destino={volver}
            mensaje="Análisis eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
