import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

/** Anotar lo que se le dio de comer al hato: se elige el alimento y «Guardar y anotar otro» deja el formulario listo para el siguiente. */
export default async function PaginaSalidaGeneral() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "nutricion", finca.plan)) redirect("/inventario");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const [{ data }, destinos] = await Promise.all([supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy }), cargarDestinosSalida(supabase, finca, rol)]);
  // Solo los que ya tienen su conteo de apertura: a los demás no hay de dónde descontarles.
  const alimentos = ((data ?? []) as FilaAlimento[]).filter((a) => a.desde !== null);

  return (
    <>
      <Link href="/inventario?vista=alimento" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Inventario
      </Link>
      <Encabezado titulo="Anotar lo que se dio" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormSalidaAlimento alimentos={alimentos} destinos={destinos} hoy={hoy} volver="/inventario?vista=alimento" />
      </div>
    </>
  );
}
