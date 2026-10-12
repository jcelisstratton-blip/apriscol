import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormFrio } from "@/components/FormFrio";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_MOMENTO_FRIO } from "@/lib/leche-calidad";
import { eliminarFrio } from "@/app/(app)/leche/gestion";

export const metadata: Metadata = { title: "Editar medición" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: registro } = await supabase.from("controles_frio").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!registro) notFound();
  if (!puedeEscribir(rol, "leche")) redirect("/leche?vista=frio");

  return (
    <>
      <Link href="/leche?vista=frio" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Editar medición" subtitulo={`${formatoFecha(registro.fecha)} · ${ETIQUETA_MOMENTO_FRIO[registro.momento]}`} />
      <div className="space-y-8 lg:max-w-xl">
        <FormFrio hoy={hoyBogota()} control={registro as never} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar esta medición"
            resumen={`la medición de ${registro.temperatura_c} °C del ${formatoFecha(registro.fecha)}`}
            accion={eliminarFrio.bind(null, id)}
            destino="/leche?vista=frio"
            mensaje="Medición eliminada"
          />
        ) : null}
      </div>
    </>
  );
}
