import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormParticipacion } from "@/components/FormParticipacion";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Premio de feria" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaParticipacionNueva({ searchParams }: { searchParams: Promise<{ feria?: string; animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) redirect("/ferias");
  const { feria, animal } = await searchParams;
  const supabase = await crearClienteServidor();

  const [{ data: ferias }, animalInicial] = await Promise.all([
    supabase.from("ferias").select("id, nombre, fecha_inicio").eq("finca_id", finca.id).order("fecha_inicio", { ascending: false }).limit(100),
    animal && ID_UUID.test(animal)
      ? supabase.from("animales").select("id, numero_arete, nombre").eq("id", animal).eq("finca_id", finca.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const volver = feria && ID_UUID.test(feria) ? `/ferias/${feria}` : animal && ID_UUID.test(animal) ? `/hato/${animal}` : "/ferias";

  return (
    <>
      <Link href={volver} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Volver
      </Link>
      <Encabezado titulo="Premio de feria" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormParticipacion
          fincaId={finca.id}
          ferias={ferias ?? []}
          feriaInicial={feria && ID_UUID.test(feria) ? feria : undefined}
          animalInicial={animalInicial.data ?? null}
          solicitud={randomUUID()}
        />
      </div>
    </>
  );
}
