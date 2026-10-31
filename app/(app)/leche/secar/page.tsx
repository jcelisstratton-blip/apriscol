import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Milk } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FormSecarVarias, type HembraPorSecar } from "@/components/FormSecarVarias";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeEscribir } from "@/lib/permisos";
import { areasSemaforo } from "@/lib/semaforos";
import { cargarSemaforos } from "@/lib/semaforos-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Secar varias" };

/** Secar varias hembras a la vez: las que la señal «Secado y último tercio» dice que ya toca secar. */
export default async function PaginaSecarVarias() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan) || !areasSemaforo(rol, finca.plan).includes("reproduccion")) redirect("/reproduccion");
  const senales = await cargarSemaforos({ supabase: await crearClienteServidor(), fincaId: finca.id, rol, plan: finca.plan, hoy: hoyBogota(), ajustes: await obtenerAjustes() }).catch(() => []);
  const hembras: HembraPorSecar[] = (senales.find((s) => s.id === "secado")?.items ?? [])
    .filter((i) => i.clave.startsWith("secar-"))
    .map((i) => ({ id: i.clave.slice("secar-".length), etiqueta: i.etiqueta, detalle: i.detalle, nivel: i.nivel }));

  return (
    <>
      <Link href="/reproduccion" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Reproducción
      </Link>
      <Encabezado titulo="Secar varias" subtitulo="Dejar de ordeñar a las que ya van a parir" />
      <div className="lg:max-w-xl">
        {hembras.length === 0 ? (
          <EstadoVacio icono={<Milk strokeWidth={1.5} />} titulo="Ninguna hembra por secar" descripcion="Cuando una gestante en ordeño se acerque al parto, aparecerá aquí para secarla." />
        ) : (
          <FormSecarVarias hembras={hembras} />
        )}
      </div>
    </>
  );
}
