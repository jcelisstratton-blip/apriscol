import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Encabezado } from "@/components/Encabezado";
import { FichaInventario } from "@/components/FichaInventario";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { ETIQUETA_PRODUCTO } from "@/lib/sanidad";
import type { FilaInventario, FilaLote } from "@/lib/inventario";
import type { InventarioMovimiento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Inventario del producto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que queda de un producto: el total, los lotes con su vencimiento, cómo viene, y el registro de conteos y ajustes. */
export default async function DetalleInventario({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "inventario", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const [productos, lotes, conteos] = await Promise.all([
    supabase.rpc("inventario_productos", { p_finca: finca.id }),
    supabase.rpc("inventario_lotes", { p_finca: finca.id, p_producto: id }),
    supabase.from("inventario_movimientos").select("*").eq("finca_id", finca.id).eq("producto_vet_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(50),
  ]);
  if (productos.error) return <Aviso tipo="error">{mensajeAmigable(productos.error.message)}</Aviso>;
  const f = ((productos.data ?? []) as FilaInventario[]).find((p) => p.producto_id === id);
  if (!f) notFound();

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Link href="/inventario" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Inventario
      </Link>
      <Encabezado titulo={f.nombre} subtitulo={ETIQUETA_PRODUCTO[f.tipo as keyof typeof ETIQUETA_PRODUCTO] ?? f.tipo} />
      {conteos.error ? <Aviso tipo="error">{mensajeAmigable(conteos.error.message)}</Aviso> : null}
      <FichaInventario f={f} lotes={(lotes.data ?? []) as FilaLote[]} conteos={(conteos.data ?? []) as InventarioMovimiento[]} puedeMover={puedeEscribir(rol, "inventario", finca.plan)} hoy={hoyBogota()} />
    </>
  );
}
