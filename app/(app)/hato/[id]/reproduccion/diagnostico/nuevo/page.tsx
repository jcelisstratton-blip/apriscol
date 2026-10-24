import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FormDiagnostico } from "@/components/FormDiagnostico";
import { obtenerContexto } from "@/lib/contexto";
import { veterinariosDeLaFinca } from "@/lib/veterinarios-servidor";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { MENSAJE_SIN_SERVICIO, MENSAJE_YA_VACIA, servicioVigente } from "@/lib/servicio-vigente";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Diagnóstico de gestación" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDiagnosticoNuevo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "reproduccion", finca.plan)) redirect(`/hato/${id}`);
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre, sexo, estado, especie").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  if (animal.sexo !== "hembra" || animal.estado !== "activo") redirect(`/hato/${id}`);
  // El servicio al que corresponde lo decide el servidor: el último, mientras no haya un parto desde entonces ni un diagnóstico «vacía».
  const [vigente, ajustes] = await Promise.all([servicioVigente(supabase, finca.id, id), obtenerAjustes()]);

  const veterinarios = await veterinariosDeLaFinca(supabase, finca.id);

  return (
    <>
      <Link href={`/hato/${id}#reproduccion`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Diagnóstico de gestación" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        {vigente.servicio ? (
          <FormDiagnostico hembraId={id} veterinarios={veterinarios} hoy={hoyBogota()} servicio={vigente.servicio} gestacionDias={ajustes.especie[animal.especie].gestacion_dias} />
        ) : (
          <div className="space-y-4">
            <Aviso tipo="atencion">{vigente.razon === "ya_vacia" ? MENSAJE_YA_VACIA : MENSAJE_SIN_SERVICIO}</Aviso>
            <Link href={`/hato/${id}/reproduccion/servicio/nuevo`} className={clasesBoton("primario")}>
              Registrar servicio
            </Link>
            <Link href={`/hato/${id}#reproduccion`} className={clasesBoton("fantasma")}>
              Volver a la ficha
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
