import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormServicio } from "@/components/FormServicio";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Registrar servicio" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un servicio es de una hembra: se registra desde su ficha y vuelve a ella. */
export default async function PaginaServicioNuevo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "reproduccion", finca.plan)) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, sexo, estado, especie").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  if (animal.sexo !== "hembra" || animal.estado !== "activo") redirect(`/hato/${id}`);
  const ajustes = await obtenerAjustes();

  return (
    <>
      <Link href={`/hato/${id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Registrar servicio" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormServicio fincaId={finca.id} hembraId={id} especie={animal.especie} gestacionDias={ajustes.especie[animal.especie].gestacion_dias} hoy={hoyBogota()} umbral={finca.umbral_endogamia} solicitud={randomUUID()} />
      </div>
    </>
  );
}
