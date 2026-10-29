import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Encabezado } from "@/components/Encabezado";
import { FichaAlimento } from "@/components/FichaAlimento";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { FilaAlimento } from "@/lib/inventario-alimento";
import type { InventarioAlimentoMovimiento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Inventario de alimento" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que queda de un alimento, para cuántos días alcanza y el registro de lo que se ha dado de comer y contado. */
export default async function DetalleAlimento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol, user } = await obtenerContexto();
  if (!puedeVer(rol, "nutricion", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const [alimentos, movimientos, ajustes] = await Promise.all([
    supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy }),
    supabase.from("inventario_alimento_movimientos").select("*").eq("finca_id", finca.id).eq("producto_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(50),
    obtenerAjustes(),
  ]);
  if (alimentos.error) return <Aviso tipo="error">{mensajeAmigable(alimentos.error.message)}</Aviso>;
  const f = ((alimentos.data ?? []) as FilaAlimento[]).find((a) => a.producto_id === id);
  if (!f) notFound();
  const filas = (movimientos.data ?? []) as InventarioAlimentoMovimiento[];

  // Para quién fue cada salida: los nombres de los corrales y lotes que aparecen. Quien no ve Corrales ni Carne (el ordeñador) no los ve y la salida no dice destino.
  const destinos: Record<string, string> = {};
  const ubicaciones = [...new Set(filas.flatMap((m) => (m.ubicacion_id ? [m.ubicacion_id] : [])))];
  const lotes = [...new Set(filas.flatMap((m) => (m.lote_id ? [m.lote_id] : [])))];
  const [u, l] = await Promise.all([
    ubicaciones.length ? supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).in("id", ubicaciones) : Promise.resolve({ data: [] }),
    lotes.length ? supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", finca.id).in("id", lotes) : Promise.resolve({ data: [] }),
  ]);
  for (const x of [...(u.data ?? []), ...(l.data ?? [])]) destinos[x.id] = x.nombre;

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Link href="/inventario?vista=alimento" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Inventario
      </Link>
      <Encabezado titulo={f.nombre} subtitulo="Alimento" />
      {movimientos.error ? <Aviso tipo="error">{mensajeAmigable(movimientos.error.message)}</Aviso> : null}
      <FichaAlimento
        f={f}
        movimientos={filas}
        destinos={destinos}
        plazoDias={ajustes.general.stock_autonomia_dias}
        hoy={hoy}
        usuarioId={user.id}
        gestiona={puedeGestionar(rol) && puedeEscribir(rol, "nutricion", finca.plan)}
        puedeAnotar={puedeEscribir(rol, "nutricion", finca.plan)}
      />
    </>
  );
}
