import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormMovimiento } from "@/components/FormMovimiento";
import type { UbicacionOpcion } from "@/components/FormMover";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import type { MotivoMovimiento, UbicacionVista } from "@/lib/tipos";

export const metadata: Metadata = { title: "Corregir movimiento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corregir un movimiento de un animal: a qué instalación fue, desde cuándo y por qué. Con `?volver=` se vuelve a esa instalación al guardar. */
export default async function PaginaEditarMovimiento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { volver } = await searchParams;
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: mov } = await supabase.from("movimientos_animales").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!mov) notFound();
  if (!puedeEscribir(rol, "corrales", finca.plan)) redirect(`/hato/${mov.animal_id}#ubicacion`);
  const [{ data: animal }, { data }] = await Promise.all([
    supabase.from("animales").select("id, numero_arete, nombre").eq("id", mov.animal_id).eq("finca_id", finca.id).maybeSingle(),
    supabase.from("v_ubicaciones").select("*").eq("finca_id", finca.id).order("tipo").order("nombre").limit(300),
  ]);
  if (!animal) notFound();
  // Las archivadas no se ofrecen, salvo la que ya tiene este movimiento.
  const opciones: UbicacionOpcion[] = ((data ?? []) as UbicacionVista[])
    .filter((u) => u.activa || u.id === mov.ubicacion_id)
    .map((u) => ({ id: u.id, nombre: u.nombre, tipo: u.tipo, uso: u.uso, capacidad: u.capacidad, ocupantes: u.ocupantes, estado: u.estado, dias_descanso: u.dias_descanso, dias_descanso_min: u.dias_descanso_min }));
  const volverA = volver && ID_UUID.test(volver) ? volver : undefined;
  const atras = volverA ? `/hato/corrales/${volverA}` : `/hato/${animal.id}#ubicacion`;

  return (
    <>
      <Link href={atras} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {volverA ? "Instalación" : (animal.nombre ?? animal.numero_arete)}
      </Link>
      <Encabezado titulo="Corregir movimiento" subtitulo={etiquetaAnimal(animal)} />
      <div className="lg:max-w-xl">
        <FormMovimiento
          movimiento={{ id: mov.id, ubicacion_id: mov.ubicacion_id, desde: mov.desde, hasta: mov.hasta, motivo: mov.motivo as MotivoMovimiento, observaciones: mov.observaciones }}
          ubicaciones={opciones}
          hoy={hoyBogota()}
          volver={atras}
          volverA={volverA}
        />
      </div>
    </>
  );
}
