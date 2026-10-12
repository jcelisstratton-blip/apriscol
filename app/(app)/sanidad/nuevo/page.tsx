import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormEvento, type DatosEvento } from "@/components/FormEvento";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Registrar sanidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registrar una vacuna, desparasitación o tratamiento. Desde la ficha de un animal (`?animal=`) es de ese animal; desde Sanidad se elige a
 * quiénes; con `?refuerzo=` se propone la siguiente aplicación de un evento anterior, ya con los animales que la esperan.
 */
export default async function PaginaEventoNuevo({ searchParams }: { searchParams: Promise<{ animal?: string; refuerzo?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal, refuerzo } = await searchParams;
  if (!puedeEscribir(rol, "sanidad")) redirect(animal && ID_UUID.test(animal) ? `/hato/${animal}` : "/sanidad");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  const { data: productos } = await supabase.from("productos_veterinarios").select("*").eq("finca_id", finca.id).eq("activo", true).order("nombre").limit(500);

  let animalFijo: { id: string; numero_arete: string; nombre: string | null } | undefined;
  if (animal) {
    if (!ID_UUID.test(animal)) notFound();
    const { data } = await supabase.from("animales").select("id, numero_arete, nombre, estado").eq("id", animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
    if (!data) notFound();
    if (data.estado !== "activo") redirect(`/hato/${animal}`);
    animalFijo = data;
  }

  let datos: DatosEvento | undefined;
  let animalesIniciales: { id: string; numero_arete: string; nombre: string | null }[] = [];
  if (refuerzo && ID_UUID.test(refuerzo)) {
    const [{ data: e }, { data: pendientes }] = await Promise.all([
      supabase.from("eventos_sanitarios").select("*").eq("id", refuerzo).eq("finca_id", finca.id).maybeSingle(),
      supabase.from("v_sanidad_pendiente").select("animal_id").eq("finca_id", finca.id).eq("evento_id", refuerzo).limit(1000),
    ]);
    if (e) {
      datos = {
        tipo: e.tipo,
        fecha: hoy,
        producto_id: e.producto_id,
        producto_nombre: e.producto_nombre,
        lote_producto: null,
        fecha_vencimiento: null,
        dosis: e.dosis,
        unidad_dosis: e.unidad_dosis,
        via: e.via,
        responsable: e.responsable,
        costo: null,
        retiro_leche_dias: e.retiro_leche_dias,
        retiro_carne_dias: e.retiro_carne_dias,
        diagnostico: null,
        observaciones: null,
        proxima_fecha: null,
      };
      animalesIniciales = await animalesPorIds(supabase, finca.id, (pendientes ?? []).map((p) => p.animal_id).filter((x): x is string => !!x));
    }
  }

  return (
    <>
      <Link href={animalFijo ? `/hato/${animalFijo.id}#sanidad` : "/sanidad"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animalFijo ? (animalFijo.nombre ?? animalFijo.numero_arete) : "Sanidad"}
      </Link>
      <Encabezado titulo={datos ? "Aplicar la siguiente dosis" : "Vacuna o tratamiento"} subtitulo={animalFijo ? etiquetaAnimal(animalFijo) : finca.nombre} />
      <div className="lg:max-w-xl">
        <FormEvento
          fincaId={finca.id}
          especies={finca.especies}
          productos={productos ?? []}
          hoy={hoy}
          animalFijo={animalFijo}
          animalesIniciales={animalesIniciales}
          datos={datos}
          solicitud={randomUUID()}
        />
      </div>
    </>
  );
}
