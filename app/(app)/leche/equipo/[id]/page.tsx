import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormMantenimiento } from "@/components/FormMantenimiento";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_MANTENIMIENTO } from "@/lib/leche-calidad";
import { eliminarMantenimiento } from "@/app/(app)/leche/gestion";

export const metadata: Metadata = { title: "Editar registro del equipo" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data: registro } = await supabase.from("mantenimiento_ordeno").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!registro) notFound();
  if (!puedeEscribir(rol, "leche")) redirect("/leche?vista=frio");

  return (
    <>
      <Link href="/leche?vista=frio" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Editar registro del equipo" subtitulo={`${formatoFecha(registro.fecha)} · ${ETIQUETA_MANTENIMIENTO[registro.tipo]}`} />
      <div className="space-y-8 lg:max-w-xl">
        <FormMantenimiento hoy={hoyBogota()} registro={registro as never} />
        {puedeGestionar(rol) ? (
          <EliminarRegistro
            etiqueta="Eliminar este registro"
            resumen={`${ETIQUETA_MANTENIMIENTO[registro.tipo]} del ${formatoFecha(registro.fecha)}`}
            accion={eliminarMantenimiento.bind(null, id)}
            destino="/leche?vista=frio"
            mensaje="Registro eliminado"
          />
        ) : null}
      </div>
    </>
  );
}
