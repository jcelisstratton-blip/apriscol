import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEmpadronamientos } from "@/components/ListaEmpadronamientos";
import { ListaPartosRepro } from "@/components/ListaPartosRepro";
import { ListaServiciosRepro } from "@/components/ListaServiciosRepro";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Reproducción" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "empadronamiento", etiqueta: "Empadronamiento" },
  { valor: "servicios", etiqueta: "Servicios" },
  { valor: "partos", etiqueta: "Partos" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Reproducción, a nivel de toda la finca: quiénes están gestantes y cuándo paren, y el compendio de servicios y partos. Registrar un
 * servicio, un diagnóstico o un parto se hace desde la ficha de cada hembra.
 */
export default async function PaginaReproduccion({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "reproduccion")) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "reproduccion");

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado titulo="Reproducción" subtitulo={finca.nombre} />
      <FilaDesplazable className="mb-3">
        {PESTANAS.map((t) => (
          <Link
            key={t.valor}
            href={t.valor === "resumen" ? "/reproduccion" : `/reproduccion?vista=${t.valor}`}
            aria-current={vista === t.valor ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
              vista === t.valor ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </FilaDesplazable>

      {vista === "resumen" ? <Resumen fincaId={finca.id} /> : null}
      {vista === "empadronamiento" ? <ListaEmpadronamientos fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "servicios" ? <ListaServiciosRepro fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "partos" ? <ListaPartosRepro fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
