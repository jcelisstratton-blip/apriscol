import Link from "next/link";
import { Coins, SearchX } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ALIMENTACION_HABITUAL, ETIQUETA_GRUPO, ETIQUETA_RUBRO, GRUPOS, GRUPO_DE, porcentaje, type GrupoGasto } from "@/lib/costos";
import { formatoFecha, hoyBogota, litros } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { rangoPeriodo, type Periodo } from "@/lib/periodos";

export type FiltrosCostos = { periodo: Periodo; desde?: string; hasta?: string };

const mes = (iso: string) => formatoFecha(iso, { month: "long", year: "numeric" });

/**
 * Costos → Resumen: lo que costó el hato en el periodo elegido (por grupo y rubro, mes a mes), lo que entró, el resultado, el costo por litro y por
 * animal, lo que queda por pagar y la pérdida por saca y mortalidad. Registrar gastos se hace en Hato → Gastos.
 */
export async function Resumen({
  fincaId,
  filtros,
  cliente,
}: {
  fincaId: string;
  filtros: FiltrosCostos;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const rango = rangoPeriodo(filtros.periodo, hoyBogota(), filtros.desde, filtros.hasta);
  const hayRango = Boolean(rango.desde || rango.hasta);
  const p = { p_finca: fincaId, p_desde: rango.desde, p_hasta: rango.hasta };
  const [indDB, rubrosDB, mesesDB, depDB] = await Promise.all([
    supabase.rpc("costos_indicadores", p),
    supabase.rpc("costos_por_rubro", p),
    supabase.rpc("costos_por_mes", p),
    supabase.rpc("costos_depreciacion", p),
  ]);
  const ind = indDB.data?.[0];
  const rubros = rubrosDB.data ?? [];
  const meses = mesesDB.data ?? [];
  const dep = depDB.data ?? [];
  const costos = Number(ind?.total_costos ?? 0);
  const ingresos = Number(ind?.ingresos_leche ?? 0) + Number(ind?.ingresos_animales ?? 0);
  const resultado = ingresos - costos;
  const litrosPeriodo = Number(ind?.litros ?? 0);
  const activos = ind?.animales_activos ?? 0;
  const sinNada = costos === 0 && ingresos === 0 && litrosPeriodo === 0 && dep.every((d) => d.animales === 0);

  const porGrupo = new Map<GrupoGasto, { total: number; rubros: typeof rubros }>();
  for (const r of rubros) {
    const g = GRUPO_DE[r.rubro];
    const previo = porGrupo.get(g) ?? { total: 0, rubros: [] };
    previo.total += Number(r.total);
    previo.rubros.push(r);
    porGrupo.set(g, previo);
  }
  const alimentacion = porcentaje(porGrupo.get("alimentacion")?.total ?? 0, costos);

  if (sinNada) {
    return hayRango ? (
      <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada en este periodo" descripcion="No hay gastos, ingresos ni producción entre esas fechas. Prueba con otro periodo.">
        <Link href="/costos" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          Quitar el filtro de fechas
        </Link>
      </EstadoVacio>
    ) : (
      <EstadoVacio icono={<Coins strokeWidth={1.5} />} titulo="Todavía no hay costos" descripcion="Registra lo que compras y pagas, y aquí verás cuánto cuesta el hato, cada litro y cada animal. Los tratamientos con costo y el alimento de la ceba se suman solos.">
        <Link href="/hato?vista=gastos" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
          Ir a Hato → Gastos
        </Link>
      </EstadoVacio>
    );
  }

  const cifras: [string, string, "ok" | "alerta" | null][] = [
    ["Costos", pesos(costos), null],
    ["Ingresos", pesos(ingresos), null],
    ["Resultado", pesos(resultado), resultado < 0 ? "alerta" : resultado > 0 ? "ok" : null],
    ["Costo por litro", litrosPeriodo > 0 ? pesos(costos / litrosPeriodo) : "—", null],
  ];

  return (
    <div className="space-y-4">
      <Tarjeta>
        <dl className="grid grid-cols-2 gap-y-3 min-[480px]:grid-cols-4 min-[480px]:divide-x min-[480px]:divide-arena">
          {cifras.map(([etiqueta, valor, tono]) => (
            <div key={etiqueta} className="min-w-0 px-1 text-center">
              <dd className={`font-display text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl ${tono === "alerta" ? "text-rojo" : tono === "ok" ? "text-ok" : ""}`}>{valor}</dd>
              <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-arena pt-2 text-center text-sm text-humo [overflow-wrap:anywhere]">
          {litrosPeriodo > 0 ? `${litros(litrosPeriodo)} L producidos` : "Sin litros registrados"}
          {activos > 0 && costos > 0 ? ` · ${pesos(costos / activos)} por animal activo` : ""}
        </p>
      </Tarjeta>

      <div className="space-y-3.5 lg:columns-2 lg:gap-x-4 lg:space-y-0 lg:[&>*]:mb-3.5 lg:[&>*]:break-inside-avoid">
        {Number(ind?.por_pagar ?? 0) > 0 ? (
          <Tarjeta titulo="Por pagar" acciones={<Link href="/hato?vista=gastos" className="text-sm font-semibold text-musgo">Hato → Gastos</Link>}>
            <p className="font-display text-2xl font-semibold tabular-nums">{pesos(Number(ind?.por_pagar))}</p>
            {Number(ind?.vencido ?? 0) > 0 ? <p className="mt-1 text-[0.9375rem] text-rojo">{pesos(Number(ind?.vencido))} ya venció.</p> : <p className="mt-1 text-[0.9375rem] text-humo">Nada vencido todavía.</p>}
          </Tarjeta>
        ) : null}

        {costos > 0 ? (
          <Tarjeta titulo="En qué se va">
            <ul className="space-y-3">
              {GRUPOS.filter((g) => porGrupo.has(g))
                .sort((a, b) => (porGrupo.get(b)?.total ?? 0) - (porGrupo.get(a)?.total ?? 0))
                .map((g) => {
                  const dato = porGrupo.get(g)!;
                  const pct = porcentaje(dato.total, costos);
                  return (
                    <li key={g}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 font-semibold">{ETIQUETA_GRUPO[g]}</span>
                        <span className="shrink-0 text-sm tabular-nums text-humo">
                          {pesos(dato.total)} · {String(pct).replace(".", ",")} %
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-arena" aria-hidden="true">
                        <div className="h-full rounded-full bg-musgo" style={{ width: `${Math.max(3, pct)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-humo [overflow-wrap:anywhere]">
                        {dato.rubros
                          .sort((a, b) => Number(b.total) - Number(a.total))
                          .slice(0, 3)
                          .map((r) => `${ETIQUETA_RUBRO[r.rubro]} ${pesos(Number(r.total))}`)
                          .join(" · ")}
                      </p>
                    </li>
                  );
                })}
            </ul>
            {porGrupo.has("alimentacion") ? (
              <div className="mt-3">
                <Aviso tipo={alimentacion > ALIMENTACION_HABITUAL.max ? "atencion" : "info"}>
                  La alimentación pesa {String(alimentacion).replace(".", ",")} % de los costos. Lo habitual en un aprisco es entre {ALIMENTACION_HABITUAL.min} y {ALIMENTACION_HABITUAL.max} %.
                </Aviso>
              </div>
            ) : null}
          </Tarjeta>
        ) : null}

        {meses.length > 0 ? (
          <Tarjeta titulo="Mes a mes">
            <ul className="divide-y divide-arena">
              {[...meses].reverse().slice(0, 12).map((m) => {
                const entra = Number(m.ingresos_leche) + Number(m.ingresos_animales);
                const queda = entra - Number(m.costos);
                return (
                  <li key={m.mes} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-semibold first-letter:uppercase">{mes(m.mes)}</span>
                      <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                        Costos {pesos(Number(m.costos))} · Ingresos {pesos(entra)}
                      </span>
                    </span>
                    <span className={`shrink-0 text-right font-semibold tabular-nums ${queda < 0 ? "text-rojo" : queda > 0 ? "text-ok" : ""}`}>{pesos(queda)}</span>
                  </li>
                );
              })}
            </ul>
            {meses.length > 12 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {meses.length - 12} meses más: descárgalos en el reporte «Costos e ingresos por mes».</p> : null}
          </Tarjeta>
        ) : null}

        {dep.some((d) => d.animales > 0) ? (
          <Tarjeta titulo="Saca y mortalidad">
            <ul className="divide-y divide-arena">
              {dep
                .filter((d) => d.animales > 0)
                .map((d) => (
                  <li key={d.tipo} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{d.tipo === "saca" ? "Saca" : "Mortalidad"}</span>
                      <span className="font-semibold tabular-nums">{pesos(Number(d.perdida))}</span>
                    </div>
                    <p className="text-sm text-humo">
                      {d.animales} {d.animales === 1 ? "animal" : "animales"}
                      {d.tipo === "saca" ? " descartados y vendidos" : " muertos o perdidos"}
                      {d.con_valor < d.animales ? `. Solo ${d.con_valor} tienen valor de compra: la cifra está incompleta.` : "."}
                    </p>
                  </li>
                ))}
            </ul>
            <p className="mt-2 border-t border-arena pt-2 text-[0.8125rem] text-humo">Se calcula con el valor de compra de cada animal, que se anota en su ficha.</p>
          </Tarjeta>
        ) : null}
      </div>
    </div>
  );
}
