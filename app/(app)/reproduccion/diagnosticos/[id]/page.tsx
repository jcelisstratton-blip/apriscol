import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormDiagnostico } from "@/components/FormDiagnostico";
import { obtenerContexto } from "@/lib/contexto";
import { cargarVeterinarios } from "@/lib/veterinarios-servidor";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { eliminarDiagnostico } from "@/app/(app)/reproduccion/actions";

export const metadata: Metadata = { title: "Editar diagnóstico" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarDiagnostico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: diagnostico } = await supabase.from("diagnosticos_gestacion").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!diagnostico) notFound();
  if (!puedeEscribir(rol, "reproduccion", finca.plan)) redirect(`/hato/${diagnostico.hembra_id}`);
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, especie").eq("id", diagnostico.hembra_id).eq("finca_id", finca.id).maybeSingle();
  if (!animal) notFound();
  const ajustes = await obtenerAjustes();
  const { data: servicio } = diagnostico.servicio_id ? await supabase.from("servicios").select("id, fecha").eq("id", diagnostico.servicio_id).eq("finca_id", finca.id).maybeSingle() : { data: null };

  const { veterinarios, puedeAgregar: puedeAgregarVeterinario } = await cargarVeterinarios(supabase, finca, rol);

  return (
    <>
      <Link href={`/hato/${animal.id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar diagnóstico" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-8 lg:max-w-xl">
        <FormDiagnostico hembraId={animal.id} veterinarios={veterinarios} puedeAgregarVeterinario={puedeAgregarVeterinario} hoy={hoyBogota()} servicio={servicio} gestacionDias={ajustes.especie[animal.especie].gestacion_dias} diagnostico={diagnostico} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este diagnóstico"
            resumen={`el diagnóstico del ${formatoFecha(diagnostico.fecha)}`}
            accion={eliminarDiagnostico.bind(null, id)}
            destino={`/hato/${animal.id}#reproduccion`}
            mensaje="Diagnóstico eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
