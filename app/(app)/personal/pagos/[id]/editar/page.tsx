import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormPagoPersonal } from "@/components/FormPagoPersonal";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { eliminarPago } from "@/app/(app)/personal/actions";
import type { PagoPersonal, Persona } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar pago" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaPagoEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("pagos_personal").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!data) notFound();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/mas/miembros?vista=pagos");
  const pago = data as PagoPersonal;
  const [{ data: personas }, ajustes] = await Promise.all([supabase.from("personal").select("*").eq("finca_id", finca.id).order("nombre"), obtenerAjustes()]);
  // Las personas retiradas no se ofrecen, salvo la de este pago.
  const personal = ((personas ?? []) as Persona[]).filter((p) => p.activo || p.id === pago.personal_id);
  const persona = personal.find((p) => p.id === pago.personal_id);

  return (
    <>
      <Link href="/mas/miembros?vista=pagos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Equipo
      </Link>
      <Encabezado titulo="Editar pago" subtitulo={finca.nombre} />
      <div className="space-y-8 lg:max-w-xl">
        <FormPagoPersonal hoy={hoyBogota()} personal={personal} factor={Number(ajustes.general.factor_prestacional)} pago={pago} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este pago"
            resumen={`Pago a ${persona?.nombre ?? "la persona"} (${pesos(pago.costo_total)}) del ${formatoFecha(pago.fecha)}`}
            accion={eliminarPago.bind(null, id)}
            destino="/mas/miembros?vista=pagos"
            mensaje="Pago eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
