import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormVenta } from "@/components/FormVenta";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerProductos, obtenerTerceros } from "@/lib/catalogos-servidor";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { ventasManuales } from "@/lib/productos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { eliminarVenta } from "@/app/(app)/hato/ventas/actions";

export const metadata: Metadata = { title: "Editar venta" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaVentaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: venta } = await supabase.from("ventas").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!venta) notFound();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/hato?vista=ventas");
  const [productos, terceros] = await Promise.all([obtenerProductos(), obtenerTerceros()]);
  const producto = productos.find((p) => p.id === venta.producto_id);

  return (
    <>
      <Link href="/hato?vista=ventas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Editar venta" subtitulo={finca.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        {/* Los productos apagados no se ofrecen, salvo el de esta venta. */}
        <FormVenta hoy={hoyBogota()} productos={ventasManuales(productos).filter((p) => p.activo || p.id === venta.producto_id)} terceros={terceros} venta={venta} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar esta venta"
            resumen={`${producto?.nombre ?? "Venta"} (${pesos(venta.valor_total)}) del ${formatoFecha(venta.fecha)}`}
            accion={eliminarVenta.bind(null, id)}
            destino="/hato?vista=ventas"
            mensaje="Venta eliminada"
          />
        ) : null}
      </div>
    </>
  );
}
