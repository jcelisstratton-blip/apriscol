import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormConsumo } from "@/components/FormConsumo";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Alimento del lote" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaConsumoNuevo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne")) redirect(`/carne/lotes/${id}`);
  const supabase = await crearClienteServidor();
  const { data: lote } = await supabase.from("lotes_ceba").select("id, nombre").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();

  return (
    <>
      <Link href={`/carne/lotes/${id}#consumo`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {lote.nombre}
      </Link>
      <Encabezado titulo="Alimento del lote" subtitulo={lote.nombre} />
      <div className="lg:max-w-xl">
        <FormConsumo loteId={id} hoy={hoyBogota()} solicitud={randomUUID()} />
      </div>
    </>
  );
}
