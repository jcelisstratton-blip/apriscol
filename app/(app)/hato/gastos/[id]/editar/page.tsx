import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormGasto } from "@/components/FormGasto";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { ETIQUETA_RUBRO } from "@/lib/costos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { eliminarGasto } from "@/app/(app)/hato/gastos/actions";

export const metadata: Metadata = { title: "Editar gasto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaGastoEditar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { volver } = await searchParams;
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: gasto } = await supabase.from("gastos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!gasto) notFound();
  if (!puedeEscribir(rol, "contabilidad")) redirect("/hato?vista=gastos");

  const [animal, { data: ubicaciones }, { data: lotes }] = await Promise.all([
    gasto.animal_id ? supabase.from("animales").select("id, numero_arete, nombre").eq("id", gasto.animal_id).eq("finca_id", finca.id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    supabase.from("ubicaciones").select("id, nombre, activa").eq("finca_id", finca.id).order("nombre").limit(300),
    supabase.from("lotes_ceba").select("id, nombre, cerrado_en").eq("finca_id", finca.id).order("nombre").limit(300),
  ]);
  // Los archivados o cerrados no se ofrecen, salvo el que ya tiene este gasto.
  const ubicacionesOfrecidas = (ubicaciones ?? []).filter((u) => u.activa || u.id === gasto.ubicacion_id).map((u) => ({ id: u.id, nombre: u.nombre }));
  const lotesOfrecidos = (lotes ?? []).filter((l) => !l.cerrado_en || l.id === gasto.lote_id).map((l) => ({ id: l.id, nombre: l.nombre }));
  const atrasAnimal = volver && ID_UUID.test(volver) ? volver : null;

  return (
    <>
      <Link href={atrasAnimal ? `/hato/${atrasAnimal}#costos` : "/hato?vista=gastos"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {atrasAnimal ? "Animal" : "Hato"}
      </Link>
      <Encabezado titulo="Editar gasto" subtitulo={finca.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormGasto
          fincaId={finca.id}
          especies={finca.especies}
          ubicaciones={ubicacionesOfrecidas}
          lotes={lotesOfrecidos}
          hoy={hoyBogota()}
          gasto={gasto}
          animalInicial={animal}
          animalDe={atrasAnimal ?? undefined}
        />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este gasto"
            resumen={`${gasto.descripcion} (${ETIQUETA_RUBRO[gasto.rubro]}, ${pesos(gasto.monto)}) del ${formatoFecha(gasto.fecha)}`}
            accion={eliminarGasto.bind(null, id)}
            destino={atrasAnimal ? `/hato/${atrasAnimal}#costos` : "/hato?vista=gastos"}
            mensaje="Gasto eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
