import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormConsumo } from "@/components/FormConsumo";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { cargarAlimentosCatalogo } from "@/lib/inventario-alimento-servidor";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { kg } from "@/lib/carne";
import { eliminarConsumo } from "@/app/(app)/carne/actions";

export const metadata: Metadata = { title: "Editar alimento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarConsumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: consumo } = await supabase.from("consumo_lote").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!consumo) notFound();
  if (!puedeEscribir(rol, "carne", finca.plan)) redirect(`/carne/lotes/${consumo.lote_id}`);
  const { data: lote } = await supabase.from("lotes_ceba").select("id, nombre").eq("id", consumo.lote_id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();

  return (
    <>
      <Link href={`/carne/lotes/${lote.id}#consumo`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {lote.nombre}
      </Link>
      <Encabezado titulo="Editar alimento" subtitulo={lote.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormConsumo loteId={lote.id} hoy={hoyBogota()} consumo={consumo} alimentos={await cargarAlimentosCatalogo(supabase, finca.id, consumo.producto_id)} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este registro"
            resumen={`${kg(consumo.kg_alimento)} de alimento del ${formatoFecha(consumo.fecha)}`}
            accion={eliminarConsumo.bind(null, id)}
            destino={`/carne/lotes/${lote.id}#consumo`}
            mensaje="Registro eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
