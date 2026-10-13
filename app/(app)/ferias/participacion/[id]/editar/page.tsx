import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarParticipacion } from "@/components/EliminarParticipacion";
import { Encabezado } from "@/components/Encabezado";
import { FormParticipacion } from "@/components/FormParticipacion";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { urlsFotosPremios } from "@/lib/fotos";
import { etiquetaAnimal } from "@/lib/animal";

export const metadata: Metadata = { title: "Editar premio" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarParticipacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: p } = await supabase.from("participaciones_feria").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!p) notFound();
  if (!puedeEscribir(rol, "ferias", finca.plan)) redirect(`/hato/${p.animal_id}`);

  const [{ data: ferias }, { data: animal }, fotos] = await Promise.all([
    supabase.from("ferias").select("id, nombre, fecha_inicio").eq("finca_id", finca.id).order("fecha_inicio", { ascending: false }).limit(100),
    supabase.from("animales").select("id, numero_arete, nombre").eq("id", p.animal_id).eq("finca_id", finca.id).maybeSingle(),
    urlsFotosPremios(supabase, [p.foto_path]),
  ]);
  if (!animal) notFound();
  const urlFoto = p.foto_path ? fotos.get(p.foto_path) : undefined;

  return (
    <>
      <Link href={`/hato/${animal.id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar premio" subtitulo={`${etiquetaAnimal(animal)} · ${p.categoria}`} />
      <div className="space-y-8 lg:max-w-xl">
        <FormParticipacion
          ferias={ferias ?? []}
          animal={animal}
          participacion={{
            id: p.id,
            feria_id: p.feria_id,
            categoria: p.categoria,
            resultado: p.resultado,
            puesto: p.puesto,
            puntaje: p.puntaje,
            premio_descripcion: p.premio_descripcion,
            premio_en_dinero: p.premio_en_dinero,
            foto: p.foto_path && urlFoto ? { path: p.foto_path, url: urlFoto } : null,
            observaciones: p.observaciones,
          }}
        />
        <div className="border-t border-arena pt-5">
          <EliminarParticipacion participacionId={p.id} resumen={`${etiquetaAnimal(animal)} · ${p.categoria}`} conFoto={Boolean(p.foto_path)} />
        </div>
      </div>
    </>
  );
}
