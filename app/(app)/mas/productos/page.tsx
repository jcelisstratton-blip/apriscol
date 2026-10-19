import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, ChevronLeft, Package, Users } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { GestionCatalogos } from "@/components/GestionCatalogos";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerProductos, obtenerTerceros } from "@/lib/catalogos-servidor";
import { escena } from "@/lib/escenas";
import { puedeEscribir, puedeVer } from "@/lib/permisos";

export const metadata: Metadata = { title: "Productos y terceros" };

const VISTAS = ["compras", "ventas", "terceros"] as const;
type Vista = (typeof VISTAS)[number];

/**
 * Productos y terceros: las listas de las que se elige al registrar una compra o una venta. Lo que se compra (con su unidad y su último precio),
 * lo que se vende, y a quiénes (proveedores y compradores). Las listas vienen armadas con lo habitual; aquí se ajustan y se completan.
 */
export default async function PaginaProductos({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "contabilidad", finca.plan)) redirect("/mas");
  const sp = await searchParams;
  const vista: Vista = VISTAS.includes(sp.vista as Vista) ? (sp.vista as Vista) : "compras";
  const [productos, terceros] = await Promise.all([obtenerProductos(), obtenerTerceros()]);

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Productos y terceros" subtitulo={finca.nombre} />
      <PestanasTarjetas
        pestanas={[
          { valor: "compras", etiqueta: "Lo que compras", detalle: `${productos.filter((p) => p.tipo === "compra").length} productos`, href: "/mas/productos", escena: escena(Package, "ambar") },
          { valor: "ventas", etiqueta: "Lo que vendes", detalle: `${productos.filter((p) => p.tipo === "venta").length} productos`, href: "/mas/productos?vista=ventas", escena: escena(Banknote, "oliva") },
          { valor: "terceros", etiqueta: "Proveedores y compradores", detalle: `${terceros.length} en tu lista`, href: "/mas/productos?vista=terceros", escena: escena(Users, "ocre") },
        ]}
        actual={vista}
      />
      <div className="lg:max-w-xl">
        <GestionCatalogos vista={vista} productos={productos} terceros={terceros} puedeEditar={puedeEscribir(rol, "contabilidad", finca.plan)} />
      </div>
    </>
  );
}
