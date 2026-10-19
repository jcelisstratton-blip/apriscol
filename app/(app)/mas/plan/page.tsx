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
import { nombrePlan, planPorId, planesSuperiores, precioMes, usd } from "@/lib/planes";
import { numeroDeFinca } from "@/lib/planes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mejorar mi plan" };

/** Mejorar el plan de la finca: solo hacia adelante. Muestra lo que ya tienes y lo que sumas con cada plan superior. */
export default async function PaginaPlan() {
  const { finca, fincas, rol, vigencia } = await obtenerContexto();
  const actual = planPorId(finca.plan);
  const superiores = planesSuperiores(finca.plan);

  const supabase = await crearClienteServidor();
  // Cada finca tiene su plan. El lugar de esta finca entre las del propietario decide el descuento: la primera paga completo, desde la segunda 10 % menos.
  const numeroFinca = await numeroDeFinca(supabase, fincas, finca.id);
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
      <Encabezado titulo="Plan de esta finca" subtitulo={finca.nombre} />

      <div className="space-y-3.5">
        <Tarjeta titulo="Tu plan">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold leading-tight">{actual.nombre}</p>
              <p className="mt-0.5 text-sm text-humo">
                {usd(precioMes(actual, false, numeroFinca))} al mes · {actual.para}
              </p>
              {finca.plan_vence_en ? (
                <p className="mt-0.5 text-sm text-humo">Pagado hasta el {formatoFecha(finca.plan_vence_en, { day: "numeric", month: "long", year: "numeric" })}</p>
              ) : null}
            </div>
            <span className="shrink-0">
              <Insignia tono={vigencia === "vigente" ? "musgo" : vigencia === "por_vencer" ? "aviso" : "alerta"}>
                {vigencia === "vigente" ? "Activo" : vigencia === "por_vencer" ? "Vence pronto" : "Vencido"}
              </Insignia>
            </span>
          </div>
          {vigencia !== "vigente" && rol === "propietario" ? (
            <Link href="/plan-vencido" className="mt-3 inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
              Renovar el plan
            </Link>
          ) : null}
        </Tarjeta>

        {rol !== "propietario" ? (
          <Aviso tipo="info">Solo el propietario de la finca puede mejorar el plan. Pídele que lo haga desde «Más → Mejorar mi plan».</Aviso>
        ) : superiores.length === 0 ? (
          <Tarjeta>
            <EstadoVacio icono={<Rocket strokeWidth={1.5} />} titulo="Ya tienes el plan más completo" descripcion="Esta finca ya tiene todos los servicios de Apriscol. Si tienes otra finca, mejora su plan desde ella." />
          </Tarjeta>
        ) : (
          <>
            {pendiente ? (
              <Aviso tipo="info">
                Tienes una solicitud pendiente para pasar a {nombrePlan(pendiente.plan_nuevo as PlanId)} ({pendiente.periodo === "anual" ? "pago anual" : "pago mensual"}), enviada el{" "}
                {formatoFecha(pendiente.created_at.slice(0, 10), { day: "numeric", month: "short" })}. Si quieres otro plan, elígelo abajo y reemplaza esa solicitud.
              </Aviso>
            ) : null}
            <MejorarPlan actual={finca.plan} numeroFinca={numeroFinca} />
          </>
        )}
      </div>
    </>
  );
}
