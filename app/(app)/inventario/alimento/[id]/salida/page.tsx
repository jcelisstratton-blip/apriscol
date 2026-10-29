import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormSalidaAlimento } from "@/components/FormSalidaAlimento";
import { cargarDestinosSalida } from "@/lib/inventario-alimento-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import type { FilaAlimento } from "@/lib/inventario-alimento";

export const metadata: Metadata = { title: "Anotar lo que se dio de comer" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anotar lo que se le dio de comer al hato, con el alimento ya elegido (desde su ficha). */
export default async function PaginaSalidaDeAlimento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "nutricion", finca.plan)) redirect(`/inventario/alimento/${id}`);
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const [{ data }, destinos] = await Promise.all([supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy }), cargarDestinosSalida(supabase, finca, rol)]);
  const alimentos = (data ?? []) as FilaAlimento[];
  const f = alimentos.find((a) => a.producto_id === id);
  if (!f) notFound();
  // Sin conteo de apertura no hay de dónde descontar: primero se cuenta.
  if (!f.desde) redirect(`/inventario/alimento/${id}`);

  return (
    <>
      <Link href={`/inventario/alimento/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {f.nombre}
      </Link>
      <Encabezado titulo="Anotar lo que se dio" subtitulo={f.nombre} />
      <div className="lg:max-w-xl">
        <FormSalidaAlimento alimentos={alimentos} alimentoId={id} destinos={destinos} hoy={hoy} volver={`/inventario/alimento/${id}`} />
      </div>
    </>
  );
}
