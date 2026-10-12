import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormLote } from "@/components/FormLote";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { eliminarLote } from "@/app/(app)/carne/actions";

export const metadata: Metadata = { title: "Editar lote" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarLote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: lote } = await supabase.from("lotes_ceba").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();
  if (!puedeEscribir(rol, "carne")) redirect(`/carne/lotes/${id}`);

  return (
    <>
      <Link href={`/carne/lotes/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {lote.nombre}
      </Link>
      <Encabezado titulo="Editar lote" subtitulo={lote.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormLote hoy={hoyBogota()} lote={lote} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este lote"
            resumen={`el lote «${lote.nombre}»`}
            consecuencia="También se borra el alimento que registraste para él. Los animales y sus pesos no se tocan: solo quedan sin lote"
            accion={eliminarLote.bind(null, id)}
            destino="/carne?vista=lotes"
            mensaje="Lote eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
