import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FormPrograma, type DatosPrograma } from "@/components/FormPrograma";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import { TIPOS_PROGRAMABLES, conRevisionAtrasada, plazosRevisionPezuna } from "@/lib/sanidad";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { estadoFamacha } from "@/lib/famacha";
import type { TipoEvento } from "@/lib/tipos";
import { leerTodo } from "@/lib/consultas";

export const metadata: Metadata = { title: "Programar sanidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Programar una vacuna, desparasitación, tratamiento o podología. Desde la ficha de un animal (`?animal=`) ya viene ese animal; con `?id=`
 * se corrige una programación; con `?grupo=podologia` vienen los animales que llevan más de seis meses sin recorte de pezuñas y con `?grupo=famacha` los que sacaron 4 o 5 en FAMACHA y siguen sin desparasitar.
 */
export default async function PaginaProgramar({ searchParams }: { searchParams: Promise<{ id?: string; animal?: string; tipo?: string; grupo?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { id, animal, tipo, grupo } = await searchParams;
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect("/hato?vista=sanidad");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  const { data: productos } = await supabase.from("productos_veterinarios").select("*").eq("finca_id", finca.id).eq("activo", true).order("nombre").limit(500);

  let datos: DatosPrograma | undefined;
  let ids: string[] = [];
  if (id) {
    if (!ID_UUID.test(id)) notFound();
    const { data: p } = await supabase.from("programas_sanitarios").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
    if (!p) notFound();
    if (p.cancelado_en) redirect("/hato?vista=sanidad");
    datos = { id: p.id, tipo: p.tipo, fecha_programada: p.fecha_programada, producto_id: p.producto_id, producto_nombre: p.producto_nombre, dosis: p.dosis, unidad_dosis: p.unidad_dosis, via: p.via, retiro_leche_dias: p.retiro_leche_dias, retiro_carne_dias: p.retiro_carne_dias, observaciones: p.observaciones };
    const { data: pendientes } = await leerTodo((d, h) => supabase.from("programa_sanitario_animales").select("animal_id").eq("programa_id", id).eq("finca_id", finca.id).is("evento_id", null).order("animal_id").range(d, h));
    ids = (pendientes ?? []).map((a) => a.animal_id);
  } else {
    const tipoInicial = TIPOS_PROGRAMABLES.includes(tipo as TipoEvento) ? (tipo as TipoEvento) : "vacunacion";
    datos = { tipo: tipoInicial, fecha_programada: hoy, producto_id: null, producto_nombre: null, dosis: null, unidad_dosis: null, via: null, retiro_leche_dias: 0, retiro_carne_dias: 0, observaciones: null };
    if (animal) {
      if (!ID_UUID.test(animal)) notFound();
      ids = [animal];
    } else if (grupo === "podologia") {
      const { data } = await leerTodo((d, h) => supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", finca.id).order("animal_id").range(d, h));
      ids = conRevisionAtrasada(data ?? [], (await obtenerAjustes()).general.podologia_inspeccion_dias, hoy).map((p) => p.animal_id).slice(0, 1000);
    } else if (grupo === "pediluvio") {
      const { data } = await leerTodo((d, h) => supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", finca.id).order("animal_id").range(d, h));
      ids = conRevisionAtrasada(data ?? [], plazosRevisionPezuna((await obtenerAjustes()).general, hoy).pediluvioDias, hoy).map((p) => p.animal_id).slice(0, 1000);
    } else if (grupo === "famacha") {
      const { data } = await leerTodo((d, h) => supabase.from("v_famacha_animal").select("animal_id, puntaje, ultima_fecha, desparasitado_en").eq("finca_id", finca.id).gte("puntaje", 4).order("animal_id").range(d, h));
      ids = (data ?? []).filter((f) => estadoFamacha(f).clave === "desparasitar").map((f) => f.animal_id).slice(0, 1000);
    }
  }
  const animales = await animalesPorIds(supabase, finca.id, ids);
  const animalFijo = animal ? animales.find((a) => a.id === animal) : undefined;
  if (animal && !animalFijo) notFound();

  return (
    <>
      <Link href={animalFijo ? `/hato/${animalFijo.id}#sanidad` : "/hato?vista=sanidad"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animalFijo ? (animalFijo.nombre ?? animalFijo.numero_arete) : "Hato"}
      </Link>
      <Encabezado titulo={id ? "Editar la programación" : "Programar una aplicación"} subtitulo={animalFijo ? etiquetaAnimal(animalFijo) : finca.nombre} />
      <div className="lg:max-w-xl">
        {!id ? <Aviso tipo="info" className="mb-4">Planea una aplicación para otro día. Cuando llegue, la registras con un toque desde «Aplicar» y queda en el historial de cada animal.</Aviso> : null}
        <FormPrograma
          fincaId={finca.id}
          especies={finca.especies}
          productos={productos ?? []}
          hoy={hoy}
          animalesIniciales={animales}
          animalDe={animalFijo?.id}
          datos={datos}
          solicitud={randomUUID()}
        />
      </div>
    </>
  );
}
