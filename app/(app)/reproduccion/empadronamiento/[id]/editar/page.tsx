import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormEmpadronamiento } from "@/components/FormEmpadronamiento";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { eliminarEmpadronamiento } from "@/app/(app)/reproduccion/empadronamiento/actions";

export const metadata: Metadata = { title: "Editar empadronamiento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEmpadronamientoEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: lote } = await supabase.from("v_empadronamientos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();
  if (!puedeEscribir(rol, "reproduccion")) redirect(`/reproduccion/empadronamiento/${id}`);

  return (
    <>
      <Link href={`/reproduccion/empadronamiento/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {lote.nombre}
      </Link>
      <Encabezado titulo="Editar empadronamiento" subtitulo={finca.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormEmpadronamiento fincaId={finca.id} especies={finca.especies} hoy={hoyBogota()} lote={lote} />
        {puedeGestionar(rol) && !lote.cerrado_en ? (
          <EliminarRegistro
            etiqueta="Eliminar este empadronamiento"
            resumen={lote.nombre}
            consecuencia={lote.hembras > 0 ? `Las ${lote.hembras} hembras asignadas salen de la temporada (los animales no se tocan)` : undefined}
            accion={eliminarEmpadronamiento.bind(null, id)}
            destino="/reproduccion?vista=empadronamiento"
            mensaje="Empadronamiento eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
