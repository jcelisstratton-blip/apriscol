import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FormEsquila, type OvejaElegible } from "@/components/FormEsquila";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { textoPlazo } from "@/lib/esquila";
import { cargarOvejasEsquila } from "@/lib/esquila-servidor";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registrar esquila" };

/** Registrar una esquila: solo se ofrecen las ovejas de lana activas (las de pelo y las que faltan por definir no se esquilan). */
export default async function PaginaNuevaEsquila({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan) || !finca.especies.includes("ovino")) redirect("/esquila");
  const { animal } = await searchParams;

  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const { general: ajustes } = await obtenerAjustes();
  const todas = await cargarOvejasEsquila(supabase, finca.id, hoy, { cadaMeses: ajustes.esquila_cada_meses, avisoDias: ajustes.esquila_aviso_dias });
  const elegibles: OvejaElegible[] = todas
    .filter((o) => o.cobertura === "lana" && o.plazo)
    .map((o) => ({
      id: o.id,
      numero_arete: o.numero_arete,
      nombre: o.nombre,
      texto: textoPlazo(o.plazo!),
      pendiente: o.plazo!.estado !== "al_dia",
      sinEsquila: o.plazo!.estado === "sin_esquila",
    }));
  const sinDefinir = todas.filter((o) => o.cobertura === "por_definir").length;

  return (
    <>
      <Link href="/esquila" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Esquila
      </Link>
      <Encabezado titulo="Registrar esquila" subtitulo={finca.nombre} />
      <div className="space-y-5">
        {sinDefinir > 0 ? (
          <Aviso tipo="info">
            {sinDefinir === 1 ? "Hay 1 oveja que no se ofrece" : `Hay ${sinDefinir} ovejas que no se ofrecen`} porque aún no sabemos si {sinDefinir === 1 ? "es" : "son"} de lana o de pelo. Defínelo en su ficha para poder esquilarla.
          </Aviso>
        ) : null}
        {elegibles.length === 0 ? (
          <Aviso tipo="atencion">No tienes ovejas de lana activas para esquilar. Las ovejas de pelo no se esquilan.</Aviso>
        ) : (
          <FormEsquila ovejas={elegibles} inicial={animal ? [animal] : []} solicitud={randomUUID()} hoy={hoy} />
        )}
      </div>
    </>
  );
}
