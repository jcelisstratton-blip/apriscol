import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCoprologico } from "@/components/FormCoprologico";
import { obtenerContexto } from "@/lib/contexto";
import { cargarVeterinarios } from "@/lib/veterinarios-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { nombreEvento } from "@/lib/sanidad";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Examen coprológico" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El coprológico es de un animal: se registra desde su ficha o, como prueba de eficacia, desde una desparasitación (`?evento=`). */
export default async function PaginaCoprologicoNuevo({ searchParams }: { searchParams: Promise<{ animal?: string; evento?: string; momento?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal, evento, momento } = await searchParams;
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect(animal && ID_UUID.test(animal) ? `/hato/${animal}` : "/sanidad");
  // Sin animal (se llegó desde el menú de Sanidad): se elige en el formulario.
  if (!animal) {
    const { veterinarios, puedeAgregar } = await cargarVeterinarios(await crearClienteServidor(), finca, rol);
    return (
      <>
        <Link href="/sanidad?vista=coprologicos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Exámenes coprológicos
        </Link>
        <Encabezado titulo="Examen coprológico" subtitulo={finca.nombre} />
        <div className="lg:max-w-xl">
          <FormCoprologico fincaId={finca.id} hoy={hoyBogota()} veterinarios={veterinarios} puedeAgregarVeterinario={puedeAgregar} />
        </div>
      </>
    );
  }
  if (!ID_UUID.test(animal)) redirect("/hato");
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("animales").select("id, numero_arete, nombre, estado").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  if (data.estado !== "activo" && !evento) redirect(`/hato/${animal}#sanidad`);

  const { veterinarios, puedeAgregar } = await cargarVeterinarios(supabase, finca, rol);
  let ev: { id: string; titulo: string } | undefined;
  if (evento) {
    if (!ID_UUID.test(evento)) notFound();
    const { data: e } = await supabase.from("eventos_sanitarios").select("id, tipo, producto_nombre, fecha").eq("id", evento).eq("finca_id", finca.id).maybeSingle();
    if (!e || e.tipo !== "desparasitacion") notFound();
    ev = { id: e.id, titulo: nombreEvento(e) };
  }

  return (
    <>
      <Link href={ev ? `/sanidad/evento/${ev.id}` : `/hato/${animal}#sanidad`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {ev ? "La desparasitación" : (data.nombre ?? data.numero_arete)}
      </Link>
      <Encabezado titulo="Examen coprológico" subtitulo={etiquetaAnimal(data)} />
      <div className="lg:max-w-xl">
        <FormCoprologico animalId={animal} hoy={hoyBogota()} evento={ev} momentoInicial={momento === "despues" ? "despues" : "antes"} veterinarios={veterinarios} puedeAgregarVeterinario={puedeAgregar} />
      </div>
    </>
  );
}
