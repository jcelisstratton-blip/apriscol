import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormDespacho } from "@/components/FormDespacho";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { obtenerProductos, obtenerTerceros } from "@/lib/catalogos-servidor";

export const metadata: Metadata = { title: "Registrar despacho" };

export default async function PaginaDespachoNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan)) redirect("/leche?vista=despachos");
  const [productos, terceros] = await Promise.all([obtenerProductos(), obtenerTerceros()]);
  const precioHabitual = productos.find((p) => p.clave === "leche_cruda")?.precio_habitual ?? null;

  return (
    <>
      <Link href="/leche?vista=despachos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Leche
      </Link>
      <Encabezado titulo="Registrar despacho" subtitulo="Leche que salió de la finca" />
      <div className="lg:max-w-xl">
        <FormDespacho hoy={hoyBogota()} solicitud={randomUUID()} terceros={terceros} precioHabitual={precioHabitual} />
      </div>
    </>
  );
}
