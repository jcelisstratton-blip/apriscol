import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormCoprologico } from "@/components/FormCoprologico";
import { obtenerContexto } from "@/lib/contexto";
import { cargarVeterinarios } from "@/lib/veterinarios-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { nombreEvento } from "@/lib/sanidad";
import { textoResultado } from "@/lib/coprologico";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarCoprologico } from "@/app/(app)/sanidad/actions";

export const metadata: Metadata = { title: "Editar examen coprológico" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarCoprologico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: examen } = await supabase.from("examenes_coprologicos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!examen) notFound();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect(`/hato/${examen.animal_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", examen.animal_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();
  const { veterinarios, puedeAgregar } = await cargarVeterinarios(supabase, finca, rol);
  let ev: { id: string; titulo: string } | undefined;
  if (examen.evento_id) {
    const { data: e } = await supabase.from("eventos_sanitarios").select("id, tipo, producto_nombre").eq("id", examen.evento_id).eq("finca_id", finca.id).maybeSingle();
    if (e) ev = { id: e.id, titulo: nombreEvento(e) };
  }
  const volver = ev ? `/sanidad/evento/${ev.id}` : `/hato/${animal.id}#sanidad`;

  return (
    <>
      <Link href={volver} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {ev ? "La desparasitación" : (animal.nombre ?? animal.numero_arete)}
      </Link>
      <Encabezado titulo="Editar examen coprológico" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormCoprologico animalId={animal.id} hoy={hoyBogota()} examen={examen} evento={ev} veterinarios={veterinarios} puedeAgregarVeterinario={puedeAgregar} />
        <EliminarRegistro
          etiqueta="Eliminar este examen"
          resumen={`${textoResultado(examen)} del ${formatoFecha(examen.fecha)}`}
          accion={eliminarCoprologico.bind(null, id)}
          destino={volver}
          mensaje="Examen eliminado"
        />
      </div>
    </>
  );
}
