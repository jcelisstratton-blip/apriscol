import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Rocket } from "lucide-react";
import { AccionActivarPlan } from "@/components/AccionActivarPlan";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan, planPorId, precioMes } from "@/lib/planes";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitudes de plan" };
const pesos = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** Solicitudes de mejora de plan pendientes: quién la pidió, a qué plan y con qué periodo de pago. Se activa cuando el pago está confirmado. */
export default async function PaginaSolicitudesPlan() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_listar_solicitudes_plan");
  const filas = data ?? [];

  return (
    <>
      <Link href="/admin" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Panel global
      </Link>
      <Encabezado titulo="Solicitudes de plan" subtitulo="Mejoras pedidas por los propietarios" />
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {!error && filas.length === 0 ? (
        <EstadoVacio icono={<Rocket strokeWidth={1.5} />} titulo="No hay solicitudes pendientes" descripcion="Cuando un propietario pida mejorar su plan, aparecerá aquí para que lo actives al confirmar el pago." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:max-w-2xl">
          {filas.map((s) => {
            const plan = planPorId(s.plan_nuevo);
            const anual = s.periodo === "anual";
            const mes = precioMes(plan, anual);
            return (
              <li key={s.id} className="min-w-0 space-y-3 rounded-3xl bg-papel p-4 ring-1 ring-arena">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold [overflow-wrap:anywhere]">{s.nombre || s.correo}</p>
                    <p className="text-sm text-humo [overflow-wrap:anywhere]">{s.correo} · {s.finca}</p>
                  </div>
                  <Insignia tono="aviso">Pendiente</Insignia>
                </div>
                <p className="text-[0.9375rem]">
                  De <span className="font-semibold">{nombrePlan(s.plan_actual)}</span> a <span className="font-semibold">{nombrePlan(s.plan_nuevo)}</span> ·{" "}
                  {anual ? `anual, ${pesos(mes * 12)} al año` : `mensual, ${pesos(mes)} al mes`}
                </p>
                <p className="text-xs text-humo">Pedida el {formatoFecha(s.creada_en.slice(0, 10), { day: "numeric", month: "short" })}</p>
                <AccionActivarPlan correo={s.correo} plan={s.plan_nuevo} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
