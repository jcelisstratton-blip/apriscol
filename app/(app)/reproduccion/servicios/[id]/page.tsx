import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormServicio } from "@/components/FormServicio";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarServicio } from "@/app/(app)/reproduccion/actions";

export const metadata: Metadata = { title: "Editar servicio" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarServicio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: servicio } = await supabase.from("servicios").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!servicio) notFound();
  if (!puedeEscribir(rol, "reproduccion", finca.plan)) redirect(`/hato/${servicio.hembra_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, especie").eq("id", servicio.hembra_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();
  const [ajustes, macho, madre] = await Promise.all([
    obtenerAjustes(),
    servicio.macho_id ? supabase.from("animales").select("id, numero_arete, nombre").eq("id", servicio.macho_id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
    servicio.madre_genetica_id ? supabase.from("animales").select("id, numero_arete, nombre").eq("id", servicio.madre_genetica_id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <Link href={`/hato/${animal.id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar servicio" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormServicio fincaId={finca.id} hembraId={animal.id} especie={animal.especie} gestacionDias={ajustes.especie[animal.especie].gestacion_dias} hoy={hoyBogota()} umbral={finca.umbral_endogamia} servicio={servicio} machoInicial={macho.data} madreInicial={madre.data} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este servicio"
            resumen={`el servicio del ${formatoFecha(servicio.fecha)}`}
            consecuencia="Los diagnósticos y partos ligados a él se conservan, pero quedan sin servicio"
            accion={eliminarServicio.bind(null, id)}
            destino={`/hato/${animal.id}#reproduccion`}
            mensaje="Servicio eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
