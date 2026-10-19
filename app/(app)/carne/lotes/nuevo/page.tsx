import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormLote } from "@/components/FormLote";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { especieUnica } from "@/lib/ajustes";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Nuevo lote de ceba" };

export default async function PaginaLoteNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne", finca.plan)) redirect("/carne?vista=lotes");
  const ajustes = await obtenerAjustes();
  const unica = especieUnica(finca.especies);

  return (
    <>
      <Link href="/carne?vista=lotes" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Carne
      </Link>
      <Encabezado titulo="Nuevo lote de ceba" subtitulo="El grupo de animales que engordas juntos" />
      <div className="lg:max-w-xl">
        <FormLote hoy={hoyBogota()} solicitud={randomUUID()} pesoMetaSugerido={unica ? ajustes.especie[unica].peso_faena_min_kg : null} />
      </div>
    </>
  );
}
