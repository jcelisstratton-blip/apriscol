import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { ControlCalidadFila } from "@/components/ControlCalidadFila";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { RequierePlan } from "@/components/RequierePlan";
import { servicioEnPlan } from "@/lib/planes";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_TIPO_BAJA } from "@/lib/bajas";
import { controlesDeSalida, etiquetaResumen, resumenControles } from "@/lib/controles";
import type { ControlCalidad } from "@/lib/tipos";

export const metadata: Metadata = { title: "Controles de calidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los controles de calidad de un animal que salió para consumo (condición corporal y, si se sacrificó, la inspección del matadero). */
export default async function PaginaControlesAnimal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "carne", finca.plan)) redirect(`/hato/${id}`);
  if (!servicioEnPlan(finca.plan, "calidad")) {
    return (
      <>
        <Encabezado titulo="Controles de calidad" subtitulo={finca.nombre} />
        <RequierePlan servicio="calidad" rol={rol} />
      </>
    );
  }
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();
  const { data: baja } = await supabase.from("bajas").select("tipo, destino_consumo, fecha").eq("animal_id", id).eq("finca_id", finca.id).maybeSingle();
  if (!baja) redirect(`/hato/${id}`);
  const aplican = controlesDeSalida(baja.tipo, baja.destino_consumo);
  if (aplican.length === 0) redirect(`/hato/${id}`);

  const { data } = await supabase.from("controles_calidad").select("*").eq("animal_id", id).eq("finca_id", finca.id);
  const controles = (data ?? []) as ControlCalidad[];
  const porTipo = new Map(controles.map((c) => [c.tipo, c]));
  const etiqueta = etiquetaResumen(resumenControles(aplican, controles));
  const puedeEditar = puedeEscribir(rol, "carne", finca.plan);

  return (
    <>
      <Link href={`/hato/${id}#salida`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Controles de calidad" subtitulo={`${etiquetaAnimal(animal)} · ${ETIQUETA_TIPO_BAJA[baja.tipo]} del ${formatoFecha(baja.fecha)}`} />
      <div className="space-y-4 lg:max-w-2xl">
        {nuevo === "1" ? <Aviso tipo="exito">Salida registrada. Ahora responde estos controles: si los hiciste, con su respaldo; si no, queda la constancia.</Aviso> : null}
        <PorQueAnalizar linea="carne" />
        <p className="px-1">
          <Insignia tono={etiqueta.tono}>{etiqueta.texto}</Insignia>
        </p>
        {aplican.map((tipo) => (
          <ControlCalidadFila
            key={tipo}
            ambito="animal"
            id={id}
            tipo={tipo}
            control={porTipo.get(tipo) ?? null}
            fechaSugerida={baja.fecha}
            hoy={hoyBogota()}
            puedeEditar={puedeEditar}
          />
        ))}
        {baja.tipo === "venta" ? <p className="px-1 text-sm text-humo">En una venta para consumo, la inspección del matadero la hace quien lo recibe.</p> : null}
      </div>
    </>
  );
}
