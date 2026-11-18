import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AnularEsquila } from "@/components/AnularEsquila";
import { Encabezado } from "@/components/Encabezado";
import { FormEditarEsquila, type OvejaDeEsquila } from "@/components/FormEditarEsquila";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { kilosVellon } from "@/lib/esquila";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { dinero } from "@/lib/moneda";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Dato } from "../../hato/[id]/fichas/Dato";

export const metadata: Metadata = { title: "Esquila" };

/** Una esquila: lo que se registró y, para quien puede escribir, el formulario para corregirla o anularla. */
export default async function PaginaEsquilaDetalle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "hato", finca.plan)) notFound();

  const supabase = await crearClienteServidor();
  const { data: esquila } = await supabase.from("esquilas").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!esquila) notFound();

  const { data: filas } = await supabase.from("esquila_animales").select("animal_id, peso_vellon_kg").eq("esquila_id", id).eq("finca_id", finca.id).limit(1000);
  const ids = (filas ?? []).map((f) => f.animal_id);
  const { data: animales } = ids.length ? await supabase.from("animales").select("id, numero_arete, nombre").in("id", ids).eq("finca_id", finca.id) : { data: [] };
  const datos = new Map((animales ?? []).map((a) => [a.id, a]));
  const ovejas: OvejaDeEsquila[] = (filas ?? [])
    .map((f) => ({ id: f.animal_id, numero_arete: datos.get(f.animal_id)?.numero_arete ?? "—", nombre: datos.get(f.animal_id)?.nombre ?? null, peso: f.peso_vellon_kg }))
    .sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));
  const total = ovejas.reduce((s, o) => s + (o.peso ?? 0), 0);
  const anulada = esquila.anulada_en !== null;
  const puedeEditar = puedeEscribir(rol, "hato", finca.plan) && !anulada;
  const resumen = `la esquila del ${formatoFecha(esquila.fecha)} (${ovejas.length} ${ovejas.length === 1 ? "oveja" : "ovejas"})`;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Link href="/esquila" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Esquila
      </Link>
      <Encabezado titulo={`Esquila del ${formatoFecha(esquila.fecha)}`} subtitulo={finca.nombre} />
      <div className="space-y-4 lg:max-w-2xl">
        {anulada ? <Aviso tipo="atencion">Esta esquila está anulada: no cuenta para los plazos de las ovejas ni para sus kilos de vellón.</Aviso> : null}

        {puedeEditar ? (
          <>
            <FormEditarEsquila
              esquila={{ id: esquila.id, fecha: esquila.fecha, esquilador: esquila.esquilador, costo: esquila.costo, notas: esquila.notas }}
              ovejas={ovejas}
              hoy={hoyBogota()}
            />
            <div className="border-t border-arena pt-3">
              <AnularEsquila esquilaId={esquila.id} resumen={resumen} />
            </div>
          </>
        ) : (
          <>
            <Tarjeta titulo="Datos">
              <dl className="divide-y divide-arena">
                <Dato etiqueta="Fecha">{formatoFecha(esquila.fecha)}</Dato>
                <Dato etiqueta="Ovejas">{ovejas.length}</Dato>
                {esquila.esquilador ? <Dato etiqueta="Esquiló">{esquila.esquilador}</Dato> : null}
                {total > 0 ? <Dato etiqueta="Vellón en total">{kilosVellon(total)}</Dato> : null}
                {esquila.costo != null ? <Dato etiqueta="Costo">{dinero(esquila.costo, finca.moneda)}</Dato> : null}
                {esquila.notas ? <Dato etiqueta="Notas">{esquila.notas}</Dato> : null}
              </dl>
            </Tarjeta>
            <Tarjeta titulo="Ovejas esquiladas">
              <ul className="divide-y divide-arena">
                {ovejas.slice(0, 50).map((o) => (
                  <li key={o.id} className="flex min-w-0 items-baseline justify-between gap-3 py-2.5 text-[0.9375rem]">
                    <Link href={`/hato/${o.id}#esquila`} className="min-w-0 font-semibold text-musgo [overflow-wrap:anywhere] hover:underline">
                      {o.numero_arete}
                      {o.nombre ? <span className="font-normal text-humo"> · {o.nombre}</span> : null}
                    </Link>
                    <span className="shrink-0 tabular-nums">{kilosVellon(o.peso)}</span>
                  </li>
                ))}
              </ul>
              {ovejas.length > 50 ? <p className="mt-2 text-sm text-humo">Se muestran las primeras 50 de {ovejas.length}.</p> : null}
            </Tarjeta>
          </>
        )}
      </div>
    </>
  );
}
