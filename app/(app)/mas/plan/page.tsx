import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Rocket } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { MejorarPlan } from "@/components/MejorarPlan";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan, planPorId, planesSuperiores } from "@/lib/planes";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mejorar mi plan" };

const pesos = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Mejorar el plan de la finca: solo hacia adelante. Muestra lo que ya tienes y lo que sumas con cada plan superior. */
export default async function PaginaPlan({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const { motivo } = await searchParams;
  const actual = planPorId(finca.plan);
  const superiores = planesSuperiores(finca.plan);

  const supabase = await crearClienteServidor();
  const { data: pendiente } = await supabase
    .from("solicitudes_plan")
    .select("plan_nuevo, periodo, created_at")
    .eq("finca_id", finca.id)
    .eq("estado", "pendiente")
    .maybeSingle();

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Mejorar mi plan" subtitulo={finca.nombre} />

      <div className="space-y-3.5">
        {motivo === "fincas" && finca.plan !== "hacienda" ? <Aviso tipo="atencion">Para manejar varias fincas necesitas el plan Hacienda.</Aviso> : null}

        <Tarjeta titulo="Tu plan">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold leading-tight">{actual.nombre}</p>
              <p className="mt-0.5 text-sm text-humo">
                {pesos(actual.mensual)} al mes · {actual.para}
              </p>
            </div>
            <span className="shrink-0">
              <Insignia tono="musgo">Activo</Insignia>
            </span>
          </div>
        </Tarjeta>

        {rol !== "propietario" ? (
          <Aviso tipo="info">Solo el propietario de la finca puede mejorar el plan. Pídele que lo haga desde «Más → Mejorar mi plan».</Aviso>
        ) : superiores.length === 0 ? (
          <Tarjeta>
            <EstadoVacio icono={<Rocket strokeWidth={1.5} />} titulo="Ya tienes el plan más completo" descripcion="Hacienda incluye todos los servicios de Apriscol. No hay nada más que mejorar." />
          </Tarjeta>
        ) : (
          <>
            {pendiente ? (
              <Aviso tipo="info">
                Tienes una solicitud pendiente para pasar a {nombrePlan(pendiente.plan_nuevo as PlanId)} ({pendiente.periodo === "anual" ? "pago anual" : "pago mensual"}), enviada el{" "}
                {formatoFecha(pendiente.created_at.slice(0, 10), { day: "numeric", month: "short" })}. Si quieres otro plan, elígelo abajo y reemplaza esa solicitud.
              </Aviso>
            ) : null}
            <MejorarPlan actual={finca.plan} />
          </>
        )}
      </div>
    </>
  );
}
