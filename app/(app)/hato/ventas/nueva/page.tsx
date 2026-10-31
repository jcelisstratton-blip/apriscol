import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FormVenta } from "@/components/FormVenta";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerProductos, obtenerTerceros } from "@/lib/catalogos-servidor";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";
import { ventasManuales } from "@/lib/productos";

export const metadata: Metadata = { title: "Registrar una venta" };

/** Registrar una venta de lo que no tiene otro módulo: se elige el producto, el comprador y si ya se cobró. */
export default async function PaginaVentaNueva() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) redirect("/hato?vista=ventas");
  const [productos, terceros] = await Promise.all([obtenerProductos(), obtenerTerceros()]);

  return (
    <>
      <Link href="/hato?vista=ventas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Registrar una venta" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <div className="mb-5">
          <Aviso tipo="info">
            Aquí van los productos que no tienen otro módulo. La <strong>leche</strong> no se registra aquí: entra sola desde{" "}
            <Link href="/leche?vista=despachos" className="font-semibold text-musgo underline underline-offset-4">Leche → Despachos</Link>, y los <strong>animales</strong> vendidos, desde su salida del hato.
          </Aviso>
        </div>
        <FormVenta hoy={hoyBogota()} productos={ventasManuales(productos).filter((p) => p.activo)} terceros={terceros} solicitud={randomUUID()} />
      </div>
    </>
  );
}
