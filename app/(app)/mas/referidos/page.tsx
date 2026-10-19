import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Gift } from "lucide-react";
import { CompartirReferido } from "@/components/CompartirReferido";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan, planPorId, usd } from "@/lib/planes";
import { comisionMensual, EJEMPLOS_REFERIDO, enlaceReferido, mesesCorridos, MESES_REFERIDO, PORCENTAJE_REFERIDO, TEXTO_PROGRAMA } from "@/lib/referidos";
import { urlDelSitio } from "@/lib/sitio";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/tipos";

export const metadata: Metadata = { title: "Referidos" };

/**
 * Referidos: el enlace personal, los términos (5 % del plan durante 6 meses) y las personas que llegaron con él. La comisión de cada una corre desde que
 * adquiere un plan; se muestra cuánto va causado. Las comisiones las liquida el equipo de Apriscol.
 */
export default async function PaginaReferidos() {
  const { user } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const [{ data: perfil }, { data: referidos }] = await Promise.all([
    supabase.from("perfiles").select("codigo_referido").eq("id", user.id).maybeSingle(),
    supabase.rpc("mis_referidos"),
  ]);
  const codigo = perfil?.codigo_referido ?? null;
  const enlace = codigo ? enlaceReferido(await urlDelSitio(), codigo) : null;
  const hoy = new Date();
  const lista = referidos ?? [];

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Referidos" subtitulo="Invita a otros criadores y gana" />
      <div className="space-y-3.5 lg:max-w-2xl">
        <Tarjeta titulo="Tu enlace">
          {enlace && codigo ? <CompartirReferido enlace={enlace} codigo={codigo} /> : <p className="text-humo">Tu enlace todavía no está listo. Vuelve a entrar en un momento.</p>}
        </Tarjeta>

        <Tarjeta titulo="Cómo funciona">
          <p className="text-[0.9375rem] leading-relaxed">{TEXTO_PROGRAMA}</p>
          <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-arena">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Lo que ganas según el plan de la persona que refieres</caption>
              <thead className="bg-lana text-humo">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Plan</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Cada mes</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">En {MESES_REFERIDO} meses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena">
                {EJEMPLOS_REFERIDO.map((e) => (
                  <tr key={e.plan}>
                    <th scope="row" className="px-3 py-2 font-semibold">{e.plan}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{e.mensual}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-humo">Calculado sobre el precio mensual de cada plan ({PORCENTAJE_REFERIDO} %). Los {MESES_REFERIDO} meses cuentan desde que la persona adquiere su plan.</p>
        </Tarjeta>

        <Tarjeta titulo="Tus referidos">
          {lista.length === 0 ? (
            <EstadoVacio icono={<Gift strokeWidth={1.5} />} titulo="Todavía no hay referidos" descripcion="Cuando alguien se registre con tu enlace aparecerá aquí, y verás su comisión desde que adquiera un plan." />
          ) : (
            <ul className="divide-y divide-arena">
              {lista.map((r, i) => {
                const plan = r.plan ? planPorId(r.plan as PlanId) : null;
                const corridos = r.desde ? mesesCorridos(r.desde, hoy, r.meses ?? MESES_REFERIDO) : 0;
                const mensual = plan ? comisionMensual(plan, Number(r.porcentaje)) : 0;
                return (
                  <li key={`${r.nombre}-${r.registrado_en}-${i}`} className="min-w-0 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold [overflow-wrap:anywhere]">{r.nombre}</p>
                        <p className="text-sm text-humo">Se registró el {formatoFecha(r.registrado_en.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      {plan && r.desde ? <Insignia tono="ok">Plan {nombrePlan(plan.id)}</Insignia> : <Insignia tono="neutro">Sin plan todavía</Insignia>}
                    </div>
                    {plan && r.desde ? (
                      <p className="mt-1 text-sm">
                        {usd(mensual)} al mes · van {corridos} de {r.meses} meses
                        {corridos > 0 ? <span className="text-humo"> · causado {usd(Math.round(mensual * corridos * 100) / 100)}</span> : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
