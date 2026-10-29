import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormApertura } from "@/components/FormApertura";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import type { FilaInventario } from "@/lib/inventario";

export const metadata: Metadata = { title: "Conteo de apertura" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El conteo de apertura de un producto (o su corrección): cuánto hay hoy en la bodega, por lote. */
export default async function PaginaApertura({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "inventario", finca.plan)) redirect(`/inventario/${id}`);
  const supabase = await crearClienteServidor();
  const [productos, aperturas] = await Promise.all([
    supabase.rpc("inventario_productos", { p_finca: finca.id }),
    supabase.from("inventario_movimientos").select("id, fecha, lote, vencimiento, cantidad").eq("finca_id", finca.id).eq("producto_vet_id", id).eq("tipo", "apertura").order("created_at"),
  ]);
  const f = ((productos.data ?? []) as FilaInventario[]).find((p) => p.producto_id === id);
  if (!f) notFound();
  const filas = aperturas.data ?? [];

  return (
    <>
      <Link href={`/inventario/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {f.nombre}
      </Link>
      <Encabezado titulo={filas.length > 0 ? "Corregir el conteo de apertura" : "Conteo de apertura"} subtitulo={f.nombre} />
      <div className="lg:max-w-xl">
        <FormApertura producto={f} hoy={hoyBogota()} fecha={filas[0]?.fecha} filas={filas} />
      </div>
    </>
  );
}
