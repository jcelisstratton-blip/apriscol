import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Utensils } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { FormRepetirDia } from "@/components/FormRepetirDia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { formatoFecha, hoyBogota, sumarDias } from "@/lib/fechas";
import { cantidadTexto } from "@/lib/inventario";
import { diasConSalidas, marcaRepeticion } from "@/lib/inventario-alimento";
import { cargarDestinosSalida } from "@/lib/inventario-alimento-servidor";

export const metadata: Metadata = { title: "Repetir las raciones de un día" };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Elegir un día reciente y repetir hoy sus raciones: lo que se le da de comer al hato casi no cambia de un día a otro. */
export default async function PaginaRepetirDia({ searchParams }: { searchParams: Promise<{ dia?: string; hecho?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "nutricion", finca.plan)) redirect("/inventario");
  const sp = await searchParams;
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  const [{ data: recientes }, { data: aperturas }, destinos] = await Promise.all([
    supabase.from("inventario_alimento_movimientos").select("id, fecha, producto_id, cantidad, ubicacion_id, lote_id").eq("finca_id", finca.id).eq("tipo", "salida").gte("fecha", sumarDias(hoy, -14)).lt("fecha", hoy).order("fecha", { ascending: false }).order("created_at").limit(500),
    supabase.from("inventario_alimento_movimientos").select("producto_id").eq("finca_id", finca.id).eq("tipo", "apertura").limit(1000),
    cargarDestinosSalida(supabase, finca, rol),
  ]);
  const sigue = new Set((aperturas ?? []).map((a) => a.producto_id));
  const filas = (recientes ?? []).filter((r) => sigue.has(r.producto_id));
  const dias = diasConSalidas(filas, hoy);
  const dia = sp.dia && FECHA.test(sp.dia) && dias.includes(sp.dia) ? sp.dia : dias[0];
  const delDia = filas.filter((f) => f.fecha === dia);
  const nombreDestino = (f: { ubicacion_id: string | null; lote_id: string | null }) => {
    const clave = f.ubicacion_id ? `ubicacion:${f.ubicacion_id}` : f.lote_id ? `lote:${f.lote_id}` : null;
    return clave ? destinos.find((d) => d.valor === clave)?.etiqueta : undefined;
  };
  const { data: productos } = delDia.length > 0 ? await supabase.from("finca_productos").select("id, nombre").eq("finca_id", finca.id).in("id", [...new Set(delDia.map((f) => f.producto_id))]) : { data: [] };
  const nombreProducto = new Map((productos ?? []).map((p) => [p.id, p.nombre]));
  const { count: yaRepetidas } = dia ? await supabase.from("inventario_alimento_movimientos").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("tipo", "salida").eq("fecha", hoy).eq("observaciones", marcaRepeticion(dia)) : { count: 0 };
  const hecho = Number(sp.hecho);

  return (
    <>
      <Link href="/inventario?vista=alimento" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Inventario
      </Link>
      <Encabezado titulo="Repetir un día" subtitulo={finca.nombre} />
      <div className="space-y-5 lg:max-w-xl">
        {Number.isInteger(hecho) && hecho > 0 ? <Aviso tipo="exito">{hecho === 1 ? "Se anotó 1 ración de hoy." : `Se anotaron ${hecho} raciones de hoy.`} Puedes corregir o borrar cada una desde la ficha del alimento.</Aviso> : null}

        {!dia ? (
          <EstadoVacio icono={<Utensils />} titulo="Todavía no hay raciones para repetir" descripcion="Cuando anotes lo que se dio de comer en un día, podrás repetirlo aquí con un toque.">
            <Link href="/inventario/alimento/salida" className="inline-flex min-h-11 items-center justify-center rounded-full bg-musgo px-5 font-semibold text-sobre-musgo">Anotar lo que se dio</Link>
          </EstadoVacio>
        ) : (
          <>
            <FilaDesplazable>
              {dias.map((d) => (
                <Link
                  key={d}
                  href={`/inventario/alimento/repetir?dia=${d}`}
                  aria-current={d === dia ? "true" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${d === dia ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"}`}
                >
                  {formatoFecha(d, { weekday: "short", day: "numeric", month: "short" })}
                </Link>
              ))}
            </FilaDesplazable>
            <Tarjeta>
              <ul className="divide-y divide-arena">
                {delDia.map((f) => (
                  <li key={f.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-semibold">{nombreProducto.get(f.producto_id) ?? "Alimento"}</span>
                      {nombreDestino(f) ? <span className="block text-sm text-humo">{nombreDestino(f)}</span> : null}
                    </span>
                    <span className="shrink-0 font-semibold">{cantidadTexto(Number(f.cantidad))} kg</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
            {yaRepetidas ? (
              <Aviso tipo="info">Ya repetiste este día hoy. Elige otro día, o anota lo que falte con «Anotar lo que se dio».</Aviso>
            ) : (
              <FormRepetirDia origen={dia} cuantas={delDia.length} solicitud={randomUUID()} />
            )}
          </>
        )}
      </div>
    </>
  );
}
