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
import { TIPOS_EVENTO } from "@/lib/sanidad";
import type { TipoEvento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Registrar sanidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registrar una vacuna, desparasitación, tratamiento o podología que ya se aplicó. Desde la ficha de un animal (`?animal=`) es de ese animal
 * (con `?tipo=` ya viene el tipo elegido); desde Hato → Sanidad se elige a quiénes; con `?refuerzo=` se propone la siguiente aplicación de un
 * evento anterior, y con `?programa=` se aplica una programación: ya vienen sus datos y los animales que la esperan.
 */
export default async function PaginaEventoNuevo({ searchParams }: { searchParams: Promise<{ animal?: string; refuerzo?: string; programa?: string; tipo?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { animal, refuerzo, programa, tipo } = await searchParams;
  if (!puedeEscribir(rol, "sanidad")) redirect(animal && ID_UUID.test(animal) ? `/hato/${animal}` : "/hato?vista=sanidad");
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

  // Aplicar una programación: sus datos y, de sus animales, los que siguen pendientes (o solo el de la ficha desde la que se llegó).
  let programaId: string | undefined;
  if (programa && ID_UUID.test(programa)) {
    const [{ data: p }, { data: pendientes }] = await Promise.all([
      supabase.from("programas_sanitarios").select("*").eq("id", programa).eq("finca_id", finca.id).is("cancelado_en", null).maybeSingle(),
      supabase.from("programa_sanitario_animales").select("animal_id").eq("programa_id", programa).eq("finca_id", finca.id).is("evento_id", null).limit(1000),
    ]);
    if (p) {
      programaId = p.id;
      datos = {
        tipo: p.tipo,
        fecha: hoy,
        producto_id: p.producto_id,
        producto_nombre: p.producto_nombre,
        lote_producto: null,
        fecha_vencimiento: null,
        dosis: p.dosis,
        unidad_dosis: p.unidad_dosis,
        via: p.via,
        responsable: null,
        costo: null,
        retiro_leche_dias: p.retiro_leche_dias,
        retiro_carne_dias: p.retiro_carne_dias,
        diagnostico: null,
        observaciones: p.observaciones,
        proxima_fecha: null,
      };
      const ids = (pendientes ?? []).map((a) => a.animal_id).filter((x) => !animalFijo || x === animalFijo.id);
      animalesIniciales = await animalesPorIds(supabase, finca.id, ids);
    }
  } else if (!datos && TIPOS_EVENTO.includes(tipo as TipoEvento)) {
    // Desde la ficha de un animal se llega con el tipo ya elegido (vacunación, desparasitación, tratamiento, podología…).
    datos = { tipo: tipo as TipoEvento, fecha: hoy, producto_id: null, producto_nombre: null, lote_producto: null, fecha_vencimiento: null, dosis: null, unidad_dosis: null, via: null, responsable: null, costo: null, retiro_leche_dias: 0, retiro_carne_dias: 0, diagnostico: null, observaciones: null, proxima_fecha: null };
  }

  return (
    <>
      <Link href={animalFijo ? `/hato/${animalFijo.id}#sanidad` : "/hato?vista=sanidad"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animalFijo ? (animalFijo.nombre ?? animalFijo.numero_arete) : "Hato"}
      </Link>
      <Encabezado titulo={programaId ? "Aplicar lo programado" : refuerzo ? "Aplicar la siguiente dosis" : "Registrar lo aplicado"} subtitulo={animalFijo ? etiquetaAnimal(animalFijo) : finca.nombre} />
      <div className="lg:max-w-xl">
        <FormEvento
          fincaId={finca.id}
          especies={finca.especies}
          productos={productos ?? []}
          hoy={hoy}
          animalFijo={animalFijo}
          animalesIniciales={animalesIniciales}
          datos={datos}
          programaId={programaId}
          solicitud={randomUUID()}
        />
      </div>
    </>
  );
}
