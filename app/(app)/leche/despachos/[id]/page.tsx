import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormDespacho } from "@/components/FormDespacho";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_DESTINO } from "@/lib/leche-calidad";
import { eliminarDespacho } from "@/app/(app)/leche/gestion";

export const metadata: Metadata = { title: "Editar despacho" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: registro } = await supabase.from("despachos_leche").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!registro) notFound();
  if (!puedeEscribir(rol, "leche", finca.plan)) redirect("/leche?vista=despachos");

  return (
    <>
      <Link href="/leche?vista=despachos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Editar despacho" subtitulo={`${formatoFecha(registro.fecha)} · ${ETIQUETA_DESTINO[registro.destino_tipo]}`} />
      <div className="space-y-8 lg:max-w-xl">
        <Link href={`/leche/despachos/${id}/controles`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-papel px-4 ring-1 ring-arena transition hover:bg-arena/40">
          <span className="font-semibold">Controles de calidad de este despacho</span>
          <ChevronRight className="size-5 shrink-0 text-humo" aria-hidden="true" />
        </Link>
        <FormDespacho hoy={hoyBogota()} despacho={registro as never} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este despacho"
            resumen={`el despacho de ${registro.litros} litros del ${formatoFecha(registro.fecha)}`}
            accion={eliminarDespacho.bind(null, id)}
            destino="/leche?vista=despachos"
            mensaje="Despacho eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
