import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { HistorialImportaciones } from "@/components/HistorialImportaciones";
import { GuiaMigracion } from "@/components/GuiaMigracion";
import { Tarjeta } from "@/components/Tarjeta";
import { clasesBoton } from "@/components/Boton";
import type { CargueVista } from "@/lib/cargues";
import { obtenerContexto } from "@/lib/contexto";
import { cargarPasosMigracion } from "@/lib/migracion-servidor";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Migrar mi finca" };

const CARGUES_RECIENTES = 50;

export default async function PaginaMigrar() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect("/hato");
  const supabase = await crearClienteServidor();

  const f = finca.id;
  const [pasos, cargues] = await Promise.all([
    cargarPasosMigracion(supabase, finca, rol),
    supabase.from("importaciones").select("id, tipo, archivo, modo, creados, actualizados, estado, created_at, grupo").eq("finca_id", f).order("created_at", { ascending: false }).limit(CARGUES_RECIENTES),
  ]);
  const historial = (cargues.data ?? []) as CargueVista[];

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Migrar mi finca" subtitulo={finca.nombre} />
      <div className="space-y-6 lg:max-w-3xl">
        <GuiaMigracion pasos={pasos} />

        <Tarjeta titulo="¿Prefieres que lo cargue otra persona?">
          <div className="space-y-2.5">
            <p className="text-[0.9375rem] text-humo">
              Puedes invitar a alguien de confianza (tu asesor o nuestro equipo) como <span className="font-semibold text-tinta">administrador</span> y él hace estos mismos pasos con tus archivos. Todo queda en «Cargues anteriores» y se puede deshacer. Cuando termine, quítale el acceso desde Equipo.
            </p>
            {puedeGestionar(rol) ? (
              <Link href="/mas/miembros" className={clasesBoton("secundario", false)}>
                Invitar a alguien al equipo <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </Tarjeta>
        {historial.length > 0 ? (
          <Tarjeta titulo="Cargues anteriores">
            <HistorialImportaciones cargues={historial} puedeDeshacer={puedeGestionar(rol)} />
          </Tarjeta>
        ) : null}
      </div>
    </>
  );
}
