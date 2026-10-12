import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormEmpadronamiento } from "@/components/FormEmpadronamiento";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Nuevo empadronamiento" };

/** Una temporada de monta se arma desde Hato → Empadronamiento y vuelve a él. */
export default async function PaginaEmpadronamientoNuevo() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "reproduccion")) redirect("/hato?vista=empadronamiento");
  return (
    <>
      <Link href="/hato?vista=empadronamiento" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Nuevo empadronamiento" subtitulo={finca.nombre} />
      <div className="lg:max-w-xl">
        <FormEmpadronamiento fincaId={finca.id} umbral={finca.umbral_endogamia} especies={finca.especies} hoy={hoyBogota()} solicitud={randomUUID()} />
      </div>
    </>
  );
}
