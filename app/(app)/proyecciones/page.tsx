import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { RequierePlan } from "@/components/RequierePlan";
import { AYUDA_PROYECCIONES } from "@/lib/ayuda";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { cargarBase } from "@/lib/proyeccion/cargar";
import { HORIZONTE_DEFECTO, HORIZONTES, limpiarAjustes } from "@/lib/proyeccion/supuestos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Proyecciones } from "./Proyecciones";

export const metadata: Metadata = { title: "Proyecciones" };

/**
 * Proyecciones (menú de todo el hato, solo propietario y administrador): cómo se verán el hato, el alimento y el dinero en 12, 24 o 36 meses,
 * partiendo de los animales de hoy y de los números de la propia finca. Carne y leche se miran juntas o por separado.
 */
export default async function PaginaProyecciones() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) redirect("/");
  if (!puedeVer(rol, "proyecciones", finca.plan)) {
    return (
      <>
        <Encabezado titulo="Proyecciones" subtitulo={finca.nombre} />
        <RequierePlan servicio="proyecciones" rol={rol} />
      </>
    );
  }

  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const [ajustes, guardada] = await Promise.all([
    obtenerAjustes(),
    supabase.from("proyecciones").select("ajustes, horizonte_meses").eq("finca_id", finca.id).order("created_at").limit(1).maybeSingle(),
  ]);
  const datos = await cargarBase(supabase, finca.id, hoy, ajustes);
  const horizonte = HORIZONTES.find((h) => h === guardada.data?.horizonte_meses) ?? HORIZONTE_DEFECTO;

  return (
    <>
      <Encabezado titulo="Proyecciones" subtitulo={finca.nombre} />
      <div className="mb-3">
        <AyudaModulo ayuda={AYUDA_PROYECCIONES} />
      </div>
      <Proyecciones
        hoy={hoy}
        base={datos.base}
        procedencia={datos.procedencia}
        inicio={datos.inicio}
        hato={datos.hato}
        gestacionDias={datos.gestacionDias}
        ajustesGuardados={limpiarAjustes(guardada.data?.ajustes)}
        horizonteGuardado={horizonte}
        puedeGuardar={puedeEscribir(rol, "proyecciones", finca.plan)}
      />
    </>
  );
}
