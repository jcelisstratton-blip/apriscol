import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormProducto } from "@/components/FormProducto";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { eliminarProducto } from "@/app/(app)/sanidad/actions";

export const metadata: Metadata = { title: "Editar producto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) redirect("/sanidad?vista=productos");
  const supabase = await crearClienteServidor();
  const { data: producto } = await supabase.from("productos_veterinarios").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!producto) notFound();
  const [{ count }, { count: conteos }] = await Promise.all([
    supabase.from("eventos_sanitarios").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("producto_id", id),
    supabase.from("inventario_movimientos").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("producto_vet_id", id),
  ]);

  return (
    <>
      <Link href="/sanidad?vista=productos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Productos
      </Link>
      <Encabezado titulo="Editar producto" subtitulo={producto.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormProducto producto={producto} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este producto"
            resumen={producto.nombre}
            consecuencia={[
              count ? `Los ${count} ${count === 1 ? "registro" : "registros"} donde se usó conservan su nombre` : null,
              conteos ? "También se borran sus conteos del inventario: dejará de contarse en la bodega" : null,
            ]
              .filter(Boolean)
              .join(". ") || undefined}
            accion={eliminarProducto.bind(null, id)}
            destino="/sanidad?vista=productos"
            mensaje="Producto eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
