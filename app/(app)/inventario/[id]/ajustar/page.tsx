import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormAjuste } from "@/components/FormAjuste";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { ajusteInicial, type FilaInventario, type FilaLote } from "@/lib/inventario";

export const metadata: Metadata = { title: "Ajustar existencias" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corregir las existencias de un producto que ya tiene su conteo de apertura. */
export default async function PaginaAjustar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ motivo?: string; lote?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) redirect(`/inventario/${id}`);
  const supabase = await crearClienteServidor();
  const [productos, lotes] = await Promise.all([supabase.rpc("inventario_productos", { p_finca: finca.id }), supabase.rpc("inventario_lotes", { p_finca: finca.id, p_producto: id })]);
  const f = ((productos.data ?? []) as FilaInventario[]).find((p) => p.producto_id === id);
  if (!f) notFound();
  // Sin conteo de apertura no hay con qué comparar: primero se cuenta.
  if (!f.desde) redirect(`/inventario/${id}/apertura`);
  const filas = ((lotes.data ?? []) as FilaLote[]).filter((l) => l.lote !== null || Math.abs(l.stock) > 0.004);

  // Desde un aviso («dar de baja este lote vencido») el formulario ya viene con el motivo, el lote y su cantidad: no se vuelve a preguntar lo que la app sabe.
  const hoy = hoyBogota();
  const inicial = ajusteInicial(f, filas, hoy, sp.motivo, sp.lote);

  return (
    <>
      <Link href={`/inventario/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {f.nombre}
      </Link>
      <Encabezado titulo="Ajustar existencias" subtitulo={f.nombre} />
      <div className="lg:max-w-xl">
        <FormAjuste producto={f} lotes={filas} hoy={hoy} inicial={inicial} />
      </div>
    </>
  );
}
