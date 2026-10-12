import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEventos } from "@/components/ListaEventos";
import { ListaProductos } from "@/components/ListaProductos";
import { ListaPruebas } from "@/components/ListaPruebas";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Sanidad" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "historial", etiqueta: "Historial" },
  { valor: "productos", etiqueta: "Productos" },
  { valor: "pruebas", etiqueta: "Pruebas" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/** Lo que más importa de la sanidad de toda la finca: qué animales están en retiro y qué dosis hay que aplicar. */
export default async function PaginaSanidad({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "sanidad")) redirect("/");
  const { vista: vistaPedida, guardado } = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === vistaPedida) ? (vistaPedida as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "sanidad");

  const accion =
    vista === "productos" ? (
      puedeEditar ? <EnlaceBoton href="/sanidad/productos/nuevo" ancho={false}>Nuevo producto</EnlaceBoton> : null
    ) : vista === "pruebas" ? null : puedeEditar ? (
      <EnlaceBoton href="/sanidad/nuevo" ancho={false}>Registrar</EnlaceBoton>
    ) : null;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Encabezado titulo="Sanidad" subtitulo={finca.nombre} acciones={accion} />
      <FilaDesplazable className="mb-3">
        {PESTANAS.map((t) => (
          <Link
            key={t.valor}
            href={t.valor === "resumen" ? "/sanidad" : `/sanidad?vista=${t.valor}`}
            aria-current={vista === t.valor ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
              vista === t.valor ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </FilaDesplazable>

      {vista === "resumen" ? <Resumen fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "historial" ? <ListaEventos fincaId={finca.id} puedeRegistrar={puedeEditar} /> : null}
      {vista === "productos" ? <ListaProductos fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "pruebas" ? <ListaPruebas fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
