import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormEvento } from "@/components/FormEvento";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { hoyBogota } from "@/lib/fechas";
import { nombreEvento } from "@/lib/sanidad";

export const metadata: Metadata = { title: "Editar registro de sanidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect(`/sanidad/evento/${id}`);
  const supabase = await crearClienteServidor();

  const [{ data: e }, { data: filas }] = await Promise.all([
    supabase.from("eventos_sanitarios").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle(),
    supabase.from("evento_sanitario_animales").select("animal_id").eq("evento_id", id).eq("finca_id", finca.id).limit(1000),
  ]);
  if (!e) notFound();
  const [animales, { data: activos }] = await Promise.all([
    animalesPorIds(supabase, finca.id, (filas ?? []).map((f) => f.animal_id)),
    supabase.from("productos_veterinarios").select("*").eq("finca_id", finca.id).eq("activo", true).order("nombre").limit(500),
  ]);
  // Si el producto de este registro fue archivado, se sigue ofreciendo aquí para no perderlo al guardar.
  let productos = activos ?? [];
  if (e.producto_id && !productos.some((p) => p.id === e.producto_id)) {
    const { data: p } = await supabase.from("productos_veterinarios").select("*").eq("id", e.producto_id).eq("finca_id", finca.id).maybeSingle();
    if (p) productos = [p, ...productos];
  }

  return (
    <>
      <Link href={`/sanidad/evento/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {nombreEvento(e)}
      </Link>
      <Encabezado titulo="Editar registro" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormEvento
          fincaId={finca.id}
          especies={finca.especies}
          productos={productos}
          hoy={hoyBogota()}
          animalesIniciales={animales}
          datos={{
            id: e.id,
            tipo: e.tipo,
            fecha: e.fecha,
            producto_id: e.producto_id,
            producto_nombre: e.producto_nombre,
            lote_producto: e.lote_producto,
            fecha_vencimiento: e.fecha_vencimiento,
            dosis: e.dosis,
            unidad_dosis: e.unidad_dosis,
            via: e.via,
            responsable: e.responsable,
            costo: e.costo,
            retiro_leche_dias: e.retiro_leche_dias,
            retiro_carne_dias: e.retiro_carne_dias,
            diagnostico: e.diagnostico,
            observaciones: e.observaciones,
            proxima_fecha: e.proxima_fecha,
          }}
        />
      </div>
    </>
  );
}
