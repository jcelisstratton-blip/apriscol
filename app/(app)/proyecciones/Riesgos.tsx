"use client";

import { useMemo } from "react";
import { Aviso } from "@/components/Aviso";
import { Tarjeta } from "@/components/Tarjeta";
import { DESCRIPCION_RANGO, equilibrio, rango, sensibilidad, type Entrada, type NombreRango } from "@/lib/proyeccion/analisis";
import { DEFINICION, type Supuestos } from "@/lib/proyeccion/supuestos";
import { formatear } from "@/lib/proyeccion/vista";

const NOMBRE_RANGO: Record<NombreRango, string> = { pesimista: "Si sale mal", base: "Como lo tienes", optimista: "Si sale bien" };

const pct = (n: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.abs(n))} %`;

/** Qué tan firme es el resultado: cuánto cambia si se mueve un número, desde qué precio se pierde dinero y qué pasa en un mal o un buen camino. */
export function Riesgos({ entrada, supuestos }: { entrada: Entrada; supuestos: Supuestos }) {
  const analisis = useMemo(
    () => ({
      filas: sensibilidad(entrada, supuestos),
      precios: (["precio_kg_vivo", "precio_litro"] as const).map((k) => equilibrio(entrada, supuestos, k)),
      caminos: rango(entrada, supuestos),
    }),
    [entrada, supuestos],
  );
  const mayor = Math.max(1, ...analisis.filas.map((f) => f.impacto));
  const preciosUtiles = analisis.precios.filter((p) => p.equilibrio !== null);

  return (
    <div className="space-y-5">
      <Aviso tipo="info">Todo se calcula sobre los {entrada.horizonte} meses completos y con los números que tienes en «Supuestos». Cada cálculo mueve una sola cosa a la vez.</Aviso>

      <section aria-labelledby="riesgo-precio" className="space-y-3">
        <h2 id="riesgo-precio" className="text-base font-bold">¿Desde qué precio pierdes dinero?</h2>
        {preciosUtiles.length === 0 ? (
          <Aviso tipo="info">Con los números actuales no se vende nada de carne ni de leche, así que no hay precio de equilibrio que calcular.</Aviso>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
            {preciosUtiles.map((p) => {
              const kilo = p.clave === "precio_kg_vivo";
              const holgura = p.holguraPct ?? 0;
              return (
                <Tarjeta key={p.clave} titulo={kilo ? "Precio por kilo vivo" : "Precio por litro de leche"}>
                  <p className="text-2xl font-bold tabular-nums">{formatear("pesos", p.equilibrio ?? 0)}</p>
                  <p className="mt-1 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">
                    es el mínimo para que lo que entra iguale a lo que sale. Hoy lo calculas en {formatear("pesos", p.actual)}:{" "}
                    {holgura >= 0 ? (
                      <>puede bajar un <strong className="text-tinta">{pct(holgura)}</strong> antes de perder dinero.</>
                    ) : (
                      <>estás <strong className="text-rojo">{pct(holgura)}</strong> por debajo: con ese precio hoy pierdes dinero.</>
                    )}
                  </p>
                </Tarjeta>
              );
            })}
          </div>
        )}
        <p className="text-[0.8125rem] text-humo">Cada precio se calcula dejando el otro como está.</p>
      </section>

      <section aria-labelledby="riesgo-mueve" className="space-y-3">
        <h2 id="riesgo-mueve" className="text-base font-bold">¿Qué mueve más tu resultado?</h2>
        <p className="text-sm text-humo">Cuánto cambia lo que queda en total si cada número sube o baja un 10 %. Arriba, lo que más pesa.</p>
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {analisis.filas.map((f) => (
            <li key={f.clave} className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <p className="mb-2 text-sm font-semibold [overflow-wrap:anywhere]">{DEFINICION[f.clave].etiqueta}</p>
              {([["Si baja un 10 %", f.siBaja], ["Si sube un 10 %", f.siSube]] as const).map(([texto, v]) => (
                <div key={texto} className="mb-1.5 last:mb-0">
                  <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 text-humo">{texto}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${v < 0 ? "text-rojo" : "text-musgo"}`}>{v > 0 ? "+" : ""}{formatear("pesos", v)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-arena" aria-hidden="true">
                    <div className={`h-full rounded-full ${v < 0 ? "bg-rojo" : "bg-musgo"}`} style={{ width: `${Math.max(2, (Math.abs(v) / mayor) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="riesgo-rango" className="space-y-3">
        <h2 id="riesgo-rango" className="text-base font-bold">Si sale mal, como está o si sale bien</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
          {analisis.caminos.map((c) => (
            <Tarjeta key={c.nombre} titulo={NOMBRE_RANGO[c.nombre]}>
              <p className={`text-2xl font-bold tabular-nums ${c.totales.flujo < 0 ? "text-rojo" : ""}`}>{formatear("pesos", c.totales.flujo)}</p>
              <p className="text-[0.8125rem] text-humo">queda en total</p>
              <dl className="mt-2.5 space-y-1">
                {c.flujoPorAnio.map((v, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                    <dt className="text-humo">{i === 0 ? "Primer año" : i === 1 ? "Segundo año" : "Tercer año"}</dt>
                    <dd className={`font-semibold tabular-nums ${v < 0 ? "text-rojo" : ""}`}>{formatear("pesos", v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 text-[0.8125rem] text-humo [overflow-wrap:anywhere]">{DESCRIPCION_RANGO[c.nombre]}</p>
            </Tarjeta>
          ))}
        </div>
      </section>
    </div>
  );
}
