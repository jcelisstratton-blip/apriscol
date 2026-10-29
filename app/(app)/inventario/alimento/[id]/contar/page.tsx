import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormConteoAlimento } from "@/components/FormConteoAlimento";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import type { FilaAlimento } from "@/lib/inventario-alimento";

export const metadata: Metadata = { title: "Contar alimento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El conteo de apertura de un alimento o un ajuste de sus existencias. Solo propietario y administrador. */
export default async function PaginaContarAlimento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol) || !puedeEscribir(rol, "nutricion", finca.plan)) redirect(`/inventario/alimento/${id}`);
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const { data } = await supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy });
  const f = ((data ?? []) as FilaAlimento[]).find((a) => a.producto_id === id);
  if (!f) notFound();

  return (
    <>
      <Link href={`/inventario/alimento/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {f.nombre}
      </Link>
      <Encabezado titulo={f.desde ? "Contar o ajustar" : "Conteo de apertura"} subtitulo={f.nombre} />
      <div className="lg:max-w-xl">
        <FormConteoAlimento alimento={f} hoy={hoy} />
      </div>
    </>
  );
}
