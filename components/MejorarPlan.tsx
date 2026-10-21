"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { solicitarMejora, type ResultadoMejora } from "@/app/(app)/mas/plan/actions";
import { DESCUENTO_FINCA_ADICIONAL, nombrePlan, PLANES, planesSuperiores, precioMes, rangoPlan, usd } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

/** Lo que suma un plan frente al actual: los servicios de los planes intermedios y del propio plan. */
function loQueSumas(actual: PlanId, destino: PlanId): string[] {
  return PLANES.filter((p) => rangoPlan(p.id) > rangoPlan(actual) && rangoPlan(p.id) <= rangoPlan(destino)).flatMap((p) => [...p.destacados.filter((d) => d !== "Animales sin límite"), ...p.funciones]);
}

/** Los planes a los que se puede pasar (solo hacia adelante) con el cambio mensual / anual y el botón para pedir la mejora. */
export function MejorarPlan({ actual, numeroFinca = 1 }: { actual: PlanId; numeroFinca?: number }) {
  const [anual, setAnual] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [eligiendo, setEligiendo] = useState<PlanId | null>(null);
  const [resultado, setResultado] = useState<ResultadoMejora | null>(null);

  const pedir = (plan: PlanId) => {
    setEligiendo(plan);
    setResultado(null);
    iniciar(async () => setResultado(await solicitarMejora(plan, anual ? "anual" : "mensual")));
  };
  const boton = (activo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 transition ${activo ? "bg-musgo text-sobre-musgo ring-musgo" : "bg-papel text-tinta ring-arena hover:ring-musgo/40"}`;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo de pago">
        <button type="button" onClick={() => setAnual(false)} aria-pressed={!anual} className={boton(!anual)}>
          Mensual
        </button>
        <button type="button" onClick={() => setAnual(true)} aria-pressed={anual} className={boton(anual)}>
          Anual · 20 % menos
        </button>
      </div>

      {numeroFinca > 1 ? (
        <Aviso tipo="info">
          Esta es tu finca n.º {numeroFinca}: cada finca adicional tiene un {Math.round(DESCUENTO_FINCA_ADICIONAL * 100)} % menos en su plan. Los precios de abajo ya lo incluyen.
        </Aviso>
      ) : null}

      {resultado?.ok ? (
        <Aviso tipo="exito">
          Recibimos tu solicitud para pasar a {nombrePlan(resultado.plan)}. Paga por Nequi con los datos que aparecen arriba y el equipo lo activa cuando confirme el pago.
        </Aviso>
      ) : null}
      {resultado && !resultado.ok ? <Aviso tipo="error">{resultado.error}</Aviso> : null}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {planesSuperiores(actual).map((p) => {
          const mes = precioMes(p, anual, numeroFinca);
          const suma = loQueSumas(actual, p.id);
          return (
            <li key={p.id} className={`flex min-w-0 flex-col rounded-3xl bg-papel p-5 ${p.recomendado ? "ring-2 ring-musgo" : "ring-1 ring-arena"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-semibold leading-tight">{p.nombre}</h3>
                {p.recomendado ? <span className="rounded-full bg-musgo/10 px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-musgo">Recomendado</span> : null}
              </div>
              <p className="mt-1.5 text-[0.9375rem] text-humo">{p.para}</p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 font-display text-3xl font-semibold tabular-nums tracking-tight">
                {usd(mes)}
                <span className="font-sans text-sm font-normal text-humo">/ mes</span>
              </p>
              <p className="mt-1 font-mono text-xs text-humo">{anual ? `Pagando cada año · ${usd(mes * 12)} al año` : "Pagando cada mes"}</p>

              <p className="mt-4 text-sm font-semibold">Con este plan sumas:</p>
              <ul className="mt-2 space-y-2">
                {suma.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-5">
                <Boton type="button" onClick={() => pedir(p.id)} pendiente={pendiente && eligiendo === p.id} cargando="Enviando…" variante={p.recomendado ? "primario" : "secundario"}>
                  Mejorar a {p.nombre}
                </Boton>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-humo">Solo se puede mejorar hacia un plan superior. Al enviar la solicitud no se cobra nada: pagas por Nequi y el equipo activa el plan al confirmar el pago.</p>
    </div>
  );
}
