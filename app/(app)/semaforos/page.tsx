import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Semaforos } from "@/components/Semaforos";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_AREA, areasSemaforo, contarSenales, type AreaSemaforo } from "@/lib/semaforos";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Semáforos" };

/**
 * Semáforos: lo que pide atención en el hato, en tres colores (rojo: actúa hoy; ámbar: programa una acción; verde: en orden). Cada persona ve solo
 * las áreas de su rol (el veterinario, reproducción y sanidad). Al tocar una tarjeta se abre qué significa y qué animales están en ese color.
 */
export default async function PaginaSemaforos({ searchParams }: { searchParams: Promise<{ area?: string; s?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const permitidas = areasSemaforo(rol, finca.plan);
  if (permitidas.length === 0) redirect("/");
  const sp = await searchParams;
  // `?area=` deja solo ese tema (si es uno de los de su rol) y `?s=` abre una señal: lo usan los botones del bot de Telegram para llevar a cada persona a lo suyo.
  const area = permitidas.includes(sp.area as AreaSemaforo) ? (sp.area as AreaSemaforo) : null;
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const ajustes = await obtenerAjustes();
  const todas = await cargarSemaforos({ supabase, fincaId: finca.id, rol, plan: finca.plan, hoy, ajustes });
  const senales = area ? todas.filter((s) => s.area === area) : todas;
  const c = contarSenales(senales);

  return (
    <>
      {area ? (
        <Link href="/semaforos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Todos los semáforos
        </Link>
      ) : null}
      <Encabezado titulo={area ? ETIQUETA_AREA[area] : "Semáforos"} subtitulo={formatoFecha(hoy, { weekday: "long", day: "numeric", month: "long" })} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Insignia tono="alerta">{c.rojo} {c.rojo === 1 ? "señal en rojo" : "señales en rojo"}</Insignia>
        <Insignia tono="aviso">{c.ambar} {c.ambar === 1 ? "señal en ámbar" : "señales en ámbar"}</Insignia>
        <Insignia tono="ok">{c.verde} en orden</Insignia>
      </div>
      <Semaforos senales={senales} abiertaInicial={typeof sp.s === "string" ? sp.s : null} />
    </>
  );
}
