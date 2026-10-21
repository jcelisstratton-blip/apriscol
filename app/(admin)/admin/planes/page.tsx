import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Rocket } from "lucide-react";
import { AccionActivarPlan } from "@/components/AccionActivarPlan";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaVigencias } from "@/components/ListaVigencias";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan, planPorId, precioMes, usd } from "@/lib/planes";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/tipos";

export const metadata: Metadata = { title: "Solicitudes de plan" };
/** Solicitudes de mejora de plan pendientes: quién la pidió, a qué plan y con qué periodo de pago. Se activa cuando el pago está confirmado. */
export default async function PaginaSolicitudesPlan() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_solicitudes_plan");
  const { data: porActivar } = await supabase.rpc("admin_fincas_por_activar");
  const pendientes = porActivar ?? [];
  const idsPendientes = new Set(pendientes.map((f) => f.finca_id));
  // Las fincas por activar tienen su propia sección: aquí quedan las renovaciones y mejoras.
  const filas = (data ?? []).filter((s) => !idsPendientes.has(s.finca_id));
  const { data: comisiones } = await supabase.rpc("admin_listar_comisiones");
  const { data: vigencias } = await supabase.rpc("admin_vigencias");

  return (
    <>
      <Link href="/admin" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Panel global
      </Link>
      <Encabezado titulo="Solicitudes de plan" subtitulo="Mejoras pedidas por los propietarios" />
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {pendientes.length > 0 ? (
        <section className="mb-8 space-y-3 lg:max-w-2xl" aria-label="Fincas por activar">
          <h2 className="font-display text-xl font-semibold">Fincas por activar</h2>
          <p className="text-sm text-humo">Fincas adicionales creadas que esperan el pago (Nequi). Actívalas al confirmarlo; mientras tanto el propietario no puede registrar nada en ellas.</p>
          <ul className="grid grid-cols-1 gap-3">
            {pendientes.map((f) => {
              const plan = planPorId("cria");
              const periodo = f.periodo === "anual" ? "anual" : f.periodo === "mensual" ? "mensual" : null;
              return (
                <li key={f.finca_id} className="min-w-0 space-y-3 rounded-3xl bg-papel p-4 ring-1 ring-arena">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold [overflow-wrap:anywhere]">{f.nombre}</p>
                      <p className="text-sm text-humo [overflow-wrap:anywhere]">{f.correo}</p>
                    </div>
                    <Insignia tono="aviso">{periodo ? "Dice que ya pagó" : "Sin pago aún"}</Insignia>
                  </div>
                  <p className="text-[0.9375rem]">
                    Finca n.º {f.numero_finca} · {nombrePlan("cria")} ·{" "}
                    {periodo === "anual"
                      ? `anual, ${usd(precioMes(plan, true, f.numero_finca) * 12)} al año`
                      : periodo === "mensual"
                        ? `mensual, ${usd(precioMes(plan, false, f.numero_finca))} al mes`
                        : `${usd(precioMes(plan, false, f.numero_finca))} al mes o ${usd(precioMes(plan, true, f.numero_finca) * 12)} al año`}
                  </p>
                  <p className="text-xs text-humo">
                    Creada el {formatoFecha(f.creada_en.slice(0, 10), { day: "numeric", month: "short" })}
                    {f.aviso_pago_en ? ` · avisó el ${formatoFecha(f.aviso_pago_en.slice(0, 10), { day: "numeric", month: "short" })}` : ""}
                  </p>
                  <div className="space-y-2">
                    {periodo ? (
                      <AccionActivarPlan fincaId={f.finca_id} plan="cria" periodo={periodo} />
                    ) : (
                      <>
                        <AccionActivarPlan fincaId={f.finca_id} plan="cria" periodo="mensual" />
                        <AccionActivarPlan fincaId={f.finca_id} plan="cria" periodo="anual" />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {!error && filas.length === 0 && pendientes.length === 0 ? (
        <EstadoVacio icono={<Rocket strokeWidth={1.5} />} titulo="No hay solicitudes pendientes" descripcion="Cuando un propietario pida mejorar su plan, aparecerá aquí para que lo actives al confirmar el pago." />
      ) : filas.length === 0 ? null : (
        <ul className="grid grid-cols-1 gap-3 lg:max-w-2xl">
          {filas.map((s) => {
            const plan = planPorId(s.plan_nuevo);
            const anual = s.periodo === "anual";
            const mes = precioMes(plan, anual, s.numero_finca);
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
                  {s.plan_actual === s.plan_nuevo ? (
                    <>
                      Renovación de <span className="font-semibold">{nombrePlan(s.plan_nuevo)}</span> ·{" "}
                    </>
                  ) : (
                    <>
                      De <span className="font-semibold">{nombrePlan(s.plan_actual)}</span> a <span className="font-semibold">{nombrePlan(s.plan_nuevo)}</span> ·{" "}
                    </>
                  )}
                  {anual ? `anual, ${usd(mes * 12)} al año` : `mensual, ${usd(mes)} al mes`}
                  {s.numero_finca > 1 ? ` · finca n.º ${s.numero_finca}, con 10 % menos` : ""}
                </p>
                <p className="text-xs text-humo">Pedida el {formatoFecha(s.creada_en.slice(0, 10), { day: "numeric", month: "short" })}</p>
                <AccionActivarPlan fincaId={s.finca_id} plan={s.plan_nuevo} periodo={s.periodo} />
              </li>
            );
          })}
        </ul>
      )}
      {(vigencias ?? []).length > 0 ? (
        <section className="mt-8 space-y-3 lg:max-w-2xl" aria-label="Vigencia de los planes">
          <h2 className="font-display text-xl font-semibold">Vigencia de los planes</h2>
          <p className="text-sm text-humo">Hasta qué día está pagada cada finca. Al vencer tiene 7 días en solo lectura y después se bloquea (solo puede descargar sus datos y pedir la renovación).</p>
          <ListaVigencias filas={vigencias ?? []} />
        </section>
      ) : null}
      {(comisiones ?? []).length > 0 ? (
        <section className="mt-8 space-y-3 lg:max-w-2xl" aria-label="Comisiones por referidos">
          <h2 className="font-display text-xl font-semibold">Comisiones por referidos</h2>
          <p className="text-sm text-humo">Quién refirió a quién, el plan que se adquirió y desde cuándo corre la comisión.</p>
          <ul className="grid grid-cols-1 gap-2.5">
            {(comisiones ?? []).map((c) => (
              <li key={`${c.referido}-${c.desde}`} className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                <p className="font-semibold [overflow-wrap:anywhere]">{c.referidor}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">refirió a {c.referido}</p>
                <p className="mt-1 text-[0.9375rem]">
                  Plan {nombrePlan(c.plan as PlanId)} · {String(c.porcentaje).replace(".00", "")} % durante {c.meses} meses desde el {formatoFecha(c.desde.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
