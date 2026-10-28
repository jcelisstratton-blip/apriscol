import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Tarjeta";
import { TarjetasExamen } from "@/components/TarjetasExamen";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_MOMENTO } from "@/lib/coprologico";
import { formatoFecha } from "@/lib/fechas";
import { nombreEvento } from "@/lib/sanidad";

export const metadata: Metadata = { title: "Examen coprológico" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const larga = { day: "numeric", month: "long", year: "numeric" } as const;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Un examen coprológico con todo lo que dice de dónde salió su resultado: el animal, la fecha de la muestra, la técnica, el laboratorio y, si es de una prueba de eficacia, la desparasitación. */
export default async function DetalleCoprologico({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "sanidad", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const { data: x } = await supabase.from("examenes_coprologicos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!x) notFound();
  const [{ data: animal }, { data: evento }] = await Promise.all([
    supabase.from("animales").select("id, numero_arete, nombre").eq("id", x.animal_id).eq("finca_id", finca.id).maybeSingle(),
    x.evento_id ? supabase.from("eventos_sanitarios").select("id, tipo, producto_nombre, fecha").eq("id", x.evento_id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/sanidad?vista=coprologicos" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Coprológicos
        </Link>
        {puedeEscribir(rol, "sanidad", finca.plan) ? (
          <Link href={`/hato/sanidad/coprologico/${x.id}/editar`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-musgo ring-1 ring-arena">
            <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar
          </Link>
        ) : null}
      </div>
      <Encabezado titulo="Examen coprológico" subtitulo={animal ? etiquetaAnimal(animal) : "Animal"} />

      <div className="grid grid-cols-1 gap-4 lg:max-w-4xl">
        <TarjetasExamen x={x} />

        <Tarjeta titulo="Registro">
          <dl className="divide-y divide-arena">
            <Dato etiqueta="Animal">{animal ? <Link href={`/hato/${animal.id}#sanidad`} className="text-musgo underline-offset-4 hover:underline">{etiquetaAnimal(animal)}</Link> : "No encontrado"}</Dato>
            <Dato etiqueta="Para qué">{x.momento === "diagnostico" ? "Diagnóstico" : ETIQUETA_MOMENTO[x.momento]}</Dato>
            {evento ? (
              <Dato etiqueta="Desparasitación">
                <Link href={`/sanidad/evento/${evento.id}`} className="text-musgo underline-offset-4 hover:underline">{nombreEvento(evento)} · {formatoFecha(evento.fecha, { day: "numeric", month: "short", year: "numeric" })}</Link>
              </Dato>
            ) : null}
            <Dato etiqueta="Registrado el">{formatoFecha(x.created_at.slice(0, 10), larga)}</Dato>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
