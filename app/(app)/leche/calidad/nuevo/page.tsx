import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCalidad } from "@/components/FormCalidad";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Análisis de calidad" };

/** Los controles de un despacho mandan aquí a registrar el análisis que les falta (`?volver=`) y se regresa a ellos al guardar. */
const VUELTA_VALIDA = /^\/leche\/despachos\/[0-9a-f-]{36}\/controles$/i;

export default async function PaginaCalidadNuevo({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan)) redirect("/leche?vista=calidad");
  const { volver: pedido } = await searchParams;
  const volver = pedido && VUELTA_VALIDA.test(pedido) ? pedido : undefined;

  return (
    <>
      <Link href={volver ?? "/leche?vista=calidad"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {volver ? "Controles del despacho" : "Leche"}
      </Link>
      <Encabezado titulo="Análisis de calidad" subtitulo="Leche del tanque o del lote" />
      <div className="lg:max-w-xl">
        <FormCalidad hoy={hoyBogota()} solicitud={randomUUID()} cancelar={volver ?? "/leche?vista=calidad"} volver={volver} />
      </div>
    </>
  );
}
