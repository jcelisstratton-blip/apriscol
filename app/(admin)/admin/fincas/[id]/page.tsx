import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FichaFincaVista } from "@/components/FichaFincaVista";
import { datosNequi } from "@/lib/pago-manual";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ficha de finca" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Una finca a fondo para el superadmin: dueño, plan y vigencia, uso, pagos, solicitudes y bitácora. */
export default async function PaginaFichaFinca({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_ficha_finca", { p_finca: id });
  if (!error && !data) notFound();

  return (
    <>
      <Link href="/admin/fincas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Fincas
      </Link>
      <Encabezado titulo={data?.finca.nombre ?? "Finca"} subtitulo="Ficha del superadmin" />
      {error || !data ? <Aviso tipo="error">{error?.message ?? "No se pudo cargar la finca."}</Aviso> : <FichaFincaVista ficha={data} nequi={datosNequi()} />}
    </>
  );
}
