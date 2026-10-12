import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Encabezado } from "@/components/Encabezado";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { armarPestanas } from "@/lib/escenas";
import { ListaPartosRepro } from "@/components/ListaPartosRepro";
import { ListaServiciosRepro } from "@/components/ListaServiciosRepro";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Resumen } from "./Resumen";
import { ResumenEmpadronamientos, type EstadoFiltroEmp } from "./ResumenEmpadronamientos";
import { esPeriodoEmp } from "@/lib/empadronamiento";

export const metadata: Metadata = { title: "Reproducción" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen", detalle: "Gestaciones y partos" },
  { valor: "empadronamiento", etiqueta: "Empadronamiento", detalle: "Temporadas de monta" },
  { valor: "servicios", etiqueta: "Servicios", detalle: "Montas e inseminaciones" },
  { valor: "partos", etiqueta: "Partos", detalle: "Crías y lactancias" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Reproducción, a nivel de toda la finca: quiénes están gestantes y cuándo paren, y el compendio de servicios y partos. Registrar un
 * servicio, un diagnóstico o un parto se hace desde la ficha de cada hembra.
 */
export default async function PaginaReproduccion({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string; estado?: string; periodo?: string; desde?: string; hasta?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "reproduccion")) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "reproduccion");

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado titulo="Reproducción" subtitulo={finca.nombre} />
      <PestanasTarjetas pestanas={armarPestanas("/reproduccion", "resumen", PESTANAS)} actual={vista} />

      {vista === "resumen" ? <Resumen fincaId={finca.id} /> : null}
      {vista === "empadronamiento" ? (
        <ResumenEmpadronamientos
          fincaId={finca.id}
          umbral={finca.umbral_endogamia}
          filtros={{
            estado: (["abiertas", "cerradas"].includes(sp.estado ?? "") ? sp.estado : "todas") as EstadoFiltroEmp,
            periodo: esPeriodoEmp(sp.periodo) ? sp.periodo : "todo",
            desde: sp.desde,
            hasta: sp.hasta,
          }}
        />
      ) : null}
      {vista === "servicios" ? <ListaServiciosRepro fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "partos" ? <ListaPartosRepro fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
