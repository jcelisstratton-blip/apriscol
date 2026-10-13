import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormGasto } from "@/components/FormGasto";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { RUBROS } from "@/lib/costos";
import { hoyBogota } from "@/lib/fechas";
import type { RubroGasto } from "@/lib/tipos";

export const metadata: Metadata = { title: "Registrar gasto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registrar un gasto. Desde la ficha de un animal (`?animal=`) ya viene cargado a ese animal y al guardar se vuelve a ella; con `?lote=` o `?ubicacion=`
 * viene cargado a ese lote o corral; con `?rubro=` ya viene el rubro.
 */
export default async function PaginaGastoNuevo({ searchParams }: { searchParams: Promise<{ animal?: string; lote?: string; ubicacion?: string; rubro?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad")) redirect("/hato?vista=gastos");
  const sp = await searchParams;
  const supabase = await crearClienteServidor();

  let animal: { id: string; numero_arete: string; nombre: string | null } | null = null;
  if (sp.animal) {
    if (!ID_UUID.test(sp.animal)) notFound();
    const { data } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", sp.animal).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
    if (!data) notFound();
    animal = data;
  }
  const [{ data: ubicaciones }, { data: lotes }] = await Promise.all([
    supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).eq("activa", true).order("nombre").limit(300),
    supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", finca.id).is("cerrado_en", null).order("nombre").limit(300),
  ]);
  const rubroInicial = (RUBROS as string[]).includes(sp.rubro ?? "") ? (sp.rubro as RubroGasto) : undefined;
  const destinoInicial =
    sp.lote && ID_UUID.test(sp.lote) && (lotes ?? []).some((l) => l.id === sp.lote)
      ? { tipo: "lote" as const, id: sp.lote }
      : sp.ubicacion && ID_UUID.test(sp.ubicacion) && (ubicaciones ?? []).some((u) => u.id === sp.ubicacion)
        ? { tipo: "ubicacion" as const, id: sp.ubicacion }
        : undefined;

  return (
    <>
      <Link href={animal ? `/hato/${animal.id}#costos` : "/hato?vista=gastos"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal ? (animal.nombre ?? animal.numero_arete) : "Hato"}
      </Link>
      <Encabezado titulo="Registrar un gasto" subtitulo={animal ? etiquetaAnimal(animal) : finca.nombre} />
      <div className="lg:max-w-xl">
        <FormGasto
          fincaId={finca.id}
          especies={finca.especies}
          ubicaciones={ubicaciones ?? []}
          lotes={lotes ?? []}
          hoy={hoyBogota()}
          animalInicial={animal}
          rubroInicial={rubroInicial}
          destinoInicial={destinoInicial}
          animalDe={animal?.id}
          solicitud={randomUUID()}
        />
      </div>
    </>
  );
}
