import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Semaforos } from "@/components/Semaforos";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { areasSemaforo, contarSenales } from "@/lib/semaforos";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Semáforos" };

/**
 * Semáforos: lo que pide atención en el hato, en tres colores (rojo: actúa hoy; ámbar: programa una acción; verde: en orden). Cada persona ve solo
 * las áreas de su rol (el veterinario, reproducción y sanidad). Al tocar una tarjeta se abre qué significa y qué animales están en ese color.
 */
export default async function PaginaSemaforos() {
  const { finca, rol } = await obtenerContexto();
  if (areasSemaforo(rol, finca.plan).length === 0) redirect("/");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const ajustes = await obtenerAjustes();
  const senales = await cargarSemaforos({ supabase, fincaId: finca.id, rol, plan: finca.plan, hoy, ajustes });
  const c = contarSenales(senales);

  return (
    <>
      <Encabezado titulo="Semáforos" subtitulo={formatoFecha(hoy, { weekday: "long", day: "numeric", month: "long" })} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Insignia tono="alerta">{c.rojo} {c.rojo === 1 ? "señal en rojo" : "señales en rojo"}</Insignia>
        <Insignia tono="aviso">{c.ambar} {c.ambar === 1 ? "señal en ámbar" : "señales en ámbar"}</Insignia>
        <Insignia tono="ok">{c.verde} en orden</Insignia>
      </div>
      <Semaforos senales={senales} />
    </>
  );
}
