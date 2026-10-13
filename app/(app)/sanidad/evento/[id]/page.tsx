import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { ListaAnimalesEvento } from "@/components/ListaAnimalesEvento";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { formatoFecha, hoyBogota, litros } from "@/lib/fechas";
import { ETIQUETA_EVENTO, ETIQUETA_VIA, estadoDosis, nombreEvento } from "@/lib/sanidad";
import { eliminarEvento } from "@/app/(app)/sanidad/actions";

export const metadata: Metadata = { title: "Registro de sanidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default async function DetalleEvento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "sanidad", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  const [{ data: e }, { data: filas }] = await Promise.all([
    supabase.from("eventos_sanitarios").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle(),
    supabase.from("evento_sanitario_animales").select("animal_id").eq("evento_id", id).eq("finca_id", finca.id).limit(1000),
  ]);
  if (!e) notFound();
  const animales = await animalesPorIds(supabase, finca.id, (filas ?? []).map((f) => f.animal_id));

  const leche = e.retiro_leche_dias > 0 ? e.fin_retiro_leche : null;
  const carne = e.retiro_carne_dias > 0 ? e.fin_retiro_carne : null;
  const dosis = e.proxima_fecha ? estadoDosis(e.proxima_fecha, hoy) : null;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/sanidad?vista=historial" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Historial
        </Link>
        {puedeEscribir(rol, "sanidad", finca.plan) ? (
          <Link href={`/sanidad/evento/${id}/editar`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-papel px-4 text-sm font-semibold text-musgo ring-1 ring-arena transition hover:bg-arena/40">
            <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar
          </Link>
        ) : null}
      </div>

      <header className="flex items-start gap-3.5 pb-4 pt-1">
        <IconoEvento tipo={e.tipo} />
        <div className="min-w-0">
          <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{nombreEvento(e)}</h1>
          <p className="mt-1 text-[0.9375rem] text-humo">
            {ETIQUETA_EVENTO[e.tipo]} · {formatoFecha(e.fecha, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </header>

      <div className="space-y-3.5 lg:columns-2 lg:gap-x-4 lg:space-y-0 lg:[&>*]:mb-3.5 lg:[&>*]:break-inside-avoid">
        {leche || carne ? (
          <Tarjeta titulo="Retiro">
            <ul className="space-y-2">
              {leche ? (
                <li className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
                  <Insignia tono={leche >= hoy ? "aviso" : "neutro"}>Leche</Insignia>
                  {leche >= hoy ? `No va al tanque hasta el ${formatoFecha(leche, { day: "numeric", month: "long" })}` : `Terminó el ${formatoFecha(leche, { day: "numeric", month: "long" })}`} ({e.retiro_leche_dias} {e.retiro_leche_dias === 1 ? "día" : "días"})
                </li>
              ) : null}
              {carne ? (
                <li className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
                  <Insignia tono={carne >= hoy ? "alerta" : "neutro"}>Carne</Insignia>
                  {carne >= hoy ? `No sale para consumo hasta el ${formatoFecha(carne, { day: "numeric", month: "long" })}` : `Terminó el ${formatoFecha(carne, { day: "numeric", month: "long" })}`} ({e.retiro_carne_dias} {e.retiro_carne_dias === 1 ? "día" : "días"})
                </li>
              ) : null}
            </ul>
          </Tarjeta>
        ) : null}

        {e.proxima_fecha && dosis ? (
          <Tarjeta titulo="Próxima dosis">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{formatoFecha(e.proxima_fecha, { day: "numeric", month: "long", year: "numeric" })}</span>
              <Insignia tono={dosis.tono}>{dosis.texto}</Insignia>
            </div>
            <p className="mt-2 text-sm text-humo">Aparece como pendiente en Sanidad hasta que se registre una nueva aplicación del mismo producto.</p>
            {puedeEscribir(rol, "sanidad", finca.plan) ? (
              <Link href={`/hato/sanidad/nuevo?refuerzo=${id}`} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                Aplicar la siguiente dosis
              </Link>
            ) : null}
          </Tarjeta>
        ) : null}

        <Tarjeta titulo="Detalle">
          <dl className="divide-y divide-arena">
            {e.dosis ? <Dato etiqueta="Dosis">{litros(e.dosis)} {e.unidad_dosis ?? ""}</Dato> : null}
            {e.via ? <Dato etiqueta="Vía">{ETIQUETA_VIA[e.via]}</Dato> : null}
            {e.lote_producto ? <Dato etiqueta="Lote">{e.lote_producto}</Dato> : null}
            {e.fecha_vencimiento ? <Dato etiqueta="Vence el lote">{formatoFecha(e.fecha_vencimiento)}</Dato> : null}
            {e.responsable ? <Dato etiqueta="Responsable">{e.responsable}</Dato> : null}
            {e.costo !== null ? <Dato etiqueta="Costo">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(e.costo)}</Dato> : null}
            {e.diagnostico ? <Dato etiqueta="Diagnóstico">{e.diagnostico}</Dato> : null}
            <Dato etiqueta="Animales">{animales.length}</Dato>
          </dl>
          {e.observaciones ? <p className="mt-3 whitespace-pre-wrap border-t border-arena pt-3 text-[0.9375rem]">{e.observaciones}</p> : null}
        </Tarjeta>

        <Tarjeta titulo={animales.length === 1 ? "Animal" : `Animales (${animales.length})`}>
          <ListaAnimalesEvento animales={animales} />
        </Tarjeta>
      </div>

      {puedeGestionar(rol) ? (
        <div className="mt-6">
          <EliminarRegistro
            etiqueta="Eliminar este registro"
            resumen={`${nombreEvento(e)} del ${formatoFecha(e.fecha)}`}
            consecuencia={leche || carne ? "Los retiros que daba dejan de aplicar" : undefined}
            accion={eliminarEvento.bind(null, id)}
            destino="/sanidad?vista=historial"
            mensaje="Registro eliminado"
          />
        </div>
      ) : null}
    </>
  );
}
