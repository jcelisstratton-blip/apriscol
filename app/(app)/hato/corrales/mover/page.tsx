import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormMover, type UbicacionOpcion } from "@/components/FormMover";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import type { MotivoMovimiento, UbicacionVista } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mover animales" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mover animales a un corral o potrero. Con `?destino=` ya viene el destino; con `?de=` vienen todos los animales de esa instalación (para
 * mover o rotar el lote); con `?animal=` es un solo animal (desde su ficha); con `?grupo=sin_ubicacion` vienen los que aún no tienen ubicación.
 */
export default async function PaginaMover({ searchParams }: { searchParams: Promise<{ destino?: string; de?: string; animal?: string; grupo?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) redirect("/hato?vista=corrales");
  const sp = await searchParams;
  const supabase = await crearClienteServidor();

  const { data } = await supabase.from("v_ubicaciones").select("*").eq("finca_id", finca.id).eq("activa", true).order("tipo").order("nombre").limit(300);
  const todas = (data ?? []) as UbicacionVista[];
  const opciones: UbicacionOpcion[] = todas.map((u) => ({ id: u.id, nombre: u.nombre, tipo: u.tipo, uso: u.uso, capacidad: u.capacidad, ocupantes: u.ocupantes, estado: u.estado, dias_descanso: u.dias_descanso, dias_descanso_min: u.dias_descanso_min }));

  let ids: string[] = [];
  let desde: string | undefined;
  let volverA: string | undefined;
  let motivo: MotivoMovimiento | undefined;
  if (sp.de) {
    if (!ID_UUID.test(sp.de)) notFound();
    const origen = todas.find((u) => u.id === sp.de);
    if (!origen) notFound();
    desde = origen.nombre;
    volverA = origen.id;
    motivo = origen.tipo === "potrero" ? "rotacion" : "traslado";
    const { data: movs } = await supabase.from("movimientos_animales").select("animal_id").eq("ubicacion_id", origen.id).eq("finca_id", finca.id).is("hasta", null).limit(1000);
    ids = (movs ?? []).map((m) => m.animal_id);
  } else if (sp.animal) {
    if (!ID_UUID.test(sp.animal)) notFound();
    ids = [sp.animal];
  } else if (sp.grupo === "sin_ubicacion") {
    const [{ data: activos }, { data: ubicados }] = await Promise.all([
      supabase.from("animales").select("id").eq("finca_id", finca.id).eq("estado", "activo").is("deleted_at", null).order("numero_arete").limit(1000),
      supabase.from("movimientos_animales").select("animal_id").eq("finca_id", finca.id).is("hasta", null).limit(5000),
    ]);
    const conUbicacion = new Set((ubicados ?? []).map((m) => m.animal_id));
    ids = (activos ?? []).map((a) => a.id).filter((i) => !conUbicacion.has(i));
  }
  const animales = await animalesPorIds(supabase, finca.id, ids);
  const animalFijo = sp.animal ? animales.find((a) => a.id === sp.animal) : undefined;
  if (sp.animal && !animalFijo) notFound();
  const destino = sp.destino && ID_UUID.test(sp.destino) && opciones.some((o) => o.id === sp.destino) ? sp.destino : undefined;

  return (
    <>
      <Link href={animalFijo ? `/hato/${animalFijo.id}#ubicacion` : volverA ? `/hato/corrales/${volverA}` : "/hato?vista=corrales"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animalFijo ? (animalFijo.nombre ?? animalFijo.numero_arete) : (desde ?? "Hato")}
      </Link>
      <Encabezado titulo="Mover animales" subtitulo={animalFijo ? etiquetaAnimal(animalFijo) : finca.nombre} />
      <div className="lg:max-w-xl">
        <FormMover
          fincaId={finca.id}
          especies={finca.especies}
          ubicaciones={opciones.filter((o) => o.id !== volverA)}
          hoy={hoyBogota()}
          animalesIniciales={animales}
          destinoInicial={destino}
          motivoInicial={motivo}
          animalDe={animalFijo?.id}
          volverA={volverA}
          desde={desde}
        />
      </div>
    </>
  );
}
