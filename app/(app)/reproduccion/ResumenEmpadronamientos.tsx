import Link from "next/link";
import { CalendarRange, ChevronDown, SearchX } from "lucide-react";
import { ChipEnlace } from "@/components/ChipEnlace";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { avanceEmp, PERIODOS_EMP, rangoPeriodo, type PeriodoEmp } from "@/lib/empadronamiento";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { porcentaje } from "@/lib/endogamia";
import type { EmpadronamientoHembra } from "@/lib/tipos";

export type EstadoFiltroEmp = "todas" | "abiertas" | "cerradas";
export type FiltrosEmp = { estado: EstadoFiltroEmp; periodo: PeriodoEmp; desde?: string; hasta?: string };

const ESTADOS: { valor: EstadoFiltroEmp; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "abiertas", etiqueta: "Abiertas" },
  { valor: "cerradas", etiqueta: "Cerradas" },
];
const MAX_HEMBRAS_VISIBLES = 60;
const MAX_TEMPORADAS = 100;

/** La dirección de esta pestaña con los filtros puestos (los que no se tocan se conservan). */
function direccion(f: FiltrosEmp, cambios: Partial<FiltrosEmp>): string {
  const n = { ...f, ...cambios };
  const q = new URLSearchParams({ vista: "empadronamiento" });
  if (n.estado !== "todas") q.set("estado", n.estado);
  if (n.periodo !== "todo") q.set("periodo", n.periodo);
  if (n.periodo === "rango") {
    if (n.desde) q.set("desde", n.desde);
    if (n.hasta) q.set("hasta", n.hasta);
  }
  return `/reproduccion?${q.toString()}`;
}

/**
 * Reproducción → Empadronamiento: el resumen de todas las temporadas de monta de la finca, con filtros por estado y por fechas, y con
 * qué hembras (y con qué semental) se hizo cada una. Armar o cerrar una temporada se hace en Hato → Empadronamiento.
 */
export async function ResumenEmpadronamientos({
  fincaId,
  umbral,
  filtros,
  cliente,
}: {
  fincaId: string;
  /** Umbral de endogamia de la finca (para colorear cada pareja). */
  umbral: number;
  filtros: FiltrosEmp;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const rango = rangoPeriodo(filtros.periodo, hoy, filtros.desde, filtros.hasta);

  let q = supabase.from("v_empadronamientos").select("*").eq("finca_id", fincaId);
  if (filtros.estado === "abiertas") q = q.is("cerrado_en", null);
  if (filtros.estado === "cerradas") q = q.not("cerrado_en", "is", null);
  if (rango.desde) q = q.gte("fecha_inicio", rango.desde);
  if (rango.hasta) q = q.lte("fecha_inicio", rango.hasta);
  const { data } = await q.order("fecha_inicio", { ascending: false }).limit(MAX_TEMPORADAS);
  const lotes = data ?? [];

  // Con qué hembras y qué sementales se hizo cada temporada.
  const hembras: EmpadronamientoHembra[] = [];
  for (let i = 0; i < lotes.length; i += 50) {
    const { data: h } = await supabase.from("empadronamiento_hembras").select("*").in("empadronamiento_id", lotes.slice(i, i + 50).map((l) => l.id)).eq("finca_id", fincaId).limit(5000);
    hembras.push(...(h ?? []));
  }
  const nombres = new Map((await animalesPorIds(supabase, fincaId, hembras.flatMap((h) => [h.hembra_id, h.macho_id]))).map((a) => [a.id, etiquetaAnimal(a)]));
  const etiqueta = (id: string) => nombres.get(id) ?? "Animal";
  const porLote = new Map<string, EmpadronamientoHembra[]>();
  for (const h of hembras) porLote.set(h.empadronamiento_id, [...(porLote.get(h.empadronamiento_id) ?? []), h]);

  const totalHembras = lotes.reduce((s, l) => s + l.hembras, 0);
  const totalExcepciones = lotes.reduce((s, l) => s + l.excepciones, 0);
  const sementales = new Set(hembras.map((h) => h.macho_id)).size;
  const cifras: [string, string][] = [
    ["Temporadas", String(lotes.length)],
    ["Hembras en monta", String(totalHembras)],
    ["Sementales", String(sementales)],
    ["Excepciones", String(totalExcepciones)],
  ];
  const hayFiltro = filtros.estado !== "todas" || filtros.periodo !== "todo";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FilaDesplazable>
          {ESTADOS.map((e) => (
            <ChipEnlace key={e.valor} href={direccion(filtros, { estado: e.valor })} activo={filtros.estado === e.valor}>
              {e.etiqueta}
            </ChipEnlace>
          ))}
        </FilaDesplazable>
        <FilaDesplazable>
          {PERIODOS_EMP.map((p) => (
            <ChipEnlace key={p.valor} href={direccion(filtros, { periodo: p.valor })} activo={filtros.periodo === p.valor}>
              {p.etiqueta}
            </ChipEnlace>
          ))}
        </FilaDesplazable>
        {filtros.periodo === "rango" ? (
          <form method="get" action="/reproduccion" className="flex flex-wrap items-end gap-2 rounded-2xl bg-lana p-3">
            <input type="hidden" name="vista" value="empadronamiento" />
            <input type="hidden" name="periodo" value="rango" />
            {filtros.estado !== "todas" ? <input type="hidden" name="estado" value={filtros.estado} /> : null}
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Desde
              <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className="mt-1 min-h-12 w-full rounded-2xl border border-arena bg-papel px-3 text-base" />
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Hasta
              <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className="mt-1 min-h-12 w-full rounded-2xl border border-arena bg-papel px-3 text-base" />
            </label>
            <button type="submit" className="min-h-12 rounded-2xl bg-musgo px-5 text-base font-semibold text-sobre-musgo">
              Aplicar
            </button>
          </form>
        ) : null}
        {rango.desde || rango.hasta ? (
          <p className="text-sm text-humo">
            Temporadas que empezaron {rango.desde ? `desde el ${formatoFecha(rango.desde)}` : ""}
            {rango.desde && rango.hasta ? " " : ""}
            {rango.hasta ? `hasta el ${formatoFecha(rango.hasta)}` : ""}.
          </p>
        ) : null}
      </div>

      {lotes.length === 0 ? (
        hayFiltro ? (
          <EstadoVacio
            icono={<SearchX strokeWidth={1.5} />}
            titulo="Ninguna temporada con ese filtro"
            descripcion="Prueba con otro periodo o quita el filtro de estado."
          >
            <Link href="/reproduccion?vista=empadronamiento" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Quitar los filtros
            </Link>
          </EstadoVacio>
        ) : (
          <EstadoVacio
            icono={<CalendarRange strokeWidth={1.5} />}
            titulo="Todavía no hay temporadas de monta"
            descripcion="El empadronamiento agrupa a los sementales con las hembras por un tiempo definido, para que los partos caigan juntos. Se arma en Hato → Empadronamiento."
          >
            <Link href="/hato?vista=empadronamiento" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Ir a Hato → Empadronamiento
            </Link>
          </EstadoVacio>
        )
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
            {cifras.map(([e, v]) => (
              <div key={e} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
                <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{v}</dd>
                <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
              </div>
            ))}
          </dl>

          <ul className="grid grid-cols-1 gap-3">
            {lotes.map((l) => {
              const a = avanceEmp(l, hoy);
              const filasLote = [...(porLote.get(l.id) ?? [])].sort((x, y) => etiqueta(x.macho_id).localeCompare(etiqueta(y.macho_id), "es") || etiqueta(x.hembra_id).localeCompare(etiqueta(y.hembra_id), "es", { numeric: true }));
              const grupos = new Map<string, EmpadronamientoHembra[]>();
              for (const h of filasLote) grupos.set(h.macho_id, [...(grupos.get(h.macho_id) ?? []), h]);
              let mostradas = 0;
              return (
                <li key={l.id} className="min-w-0 overflow-hidden rounded-2xl bg-papel ring-1 ring-arena">
                  <Link href={`/reproduccion/empadronamiento/${l.id}`} className="block px-3.5 py-3 transition active:bg-arena/40">
                    <span className="block font-bold [overflow-wrap:anywhere]">{l.nombre}</span>
                    <span className="block text-sm text-humo">
                      {l.especie === "caprino" ? "Cabras" : "Ovejas"} · {formatoFecha(l.fecha_inicio, { day: "numeric", month: "short" })} al {formatoFecha(l.cerrado_en ?? l.fecha_fin_prevista, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {l.cerrado_en ? <Insignia>Cerrada</Insignia> : a.atrasado ? <Insignia tono="aviso">Pasó la fecha de cierre</Insignia> : <Insignia tono="musgo">Abierta · {a.faltan === 0 ? "cierra hoy" : `faltan ${a.faltan} días`}</Insignia>}
                      <span className="text-xs text-humo">
                        {l.machos} {l.machos === 1 ? "semental" : "sementales"} · {l.hembras} {l.hembras === 1 ? "hembra" : "hembras"}
                      </span>
                      {l.excepciones > 0 ? <Insignia tono="alerta">{l.excepciones} {l.excepciones === 1 ? "excepción" : "excepciones"}</Insignia> : null}
                    </span>
                  </Link>
                  {filasLote.length > 0 ? (
                    <details className="group border-t border-arena">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-semibold text-musgo [&::-webkit-details-marker]:hidden">
                        Ver las {filasLote.length} {filasLote.length === 1 ? "hembra" : "hembras"}
                        <ChevronDown className="size-4 text-humo transition group-open:rotate-180" strokeWidth={2} aria-hidden="true" />
                      </summary>
                      <div className="space-y-3 px-3.5 pb-3.5">
                        {[...grupos.entries()].map(([machoId, hs]) => (
                          <div key={machoId}>
                            <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                              Con {etiqueta(machoId)} <span className="font-normal text-humo">· {hs.length}</span>
                            </p>
                            <ul className="mt-1 divide-y divide-arena">
                              {hs.map((h) => {
                                if (mostradas >= MAX_HEMBRAS_VISIBLES) return null;
                                mostradas++;
                                return (
                                  <li key={h.id} className="flex items-center justify-between gap-2 py-1.5">
                                    <Link href={`/hato/${h.hembra_id}#reproduccion`} className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere] hover:underline">
                                      {etiqueta(h.hembra_id)}
                                    </Link>
                                    <span className="flex shrink-0 items-center gap-1.5">
                                      {h.excepcion ? <Insignia tono="alerta">Excepción</Insignia> : null}
                                      <span className="text-xs tabular-nums text-humo">{porcentaje(Number(h.endogamia))}</span>
                                      <NivelEndogamia f={Number(h.endogamia)} umbral={umbral} />
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                        {filasLote.length > MAX_HEMBRAS_VISIBLES ? (
                          <Link href={`/reproduccion/empadronamiento/${l.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                            Y {filasLote.length - MAX_HEMBRAS_VISIBLES} más: ábrela para verlas todas
                          </Link>
                        ) : null}
                      </div>
                    </details>
                  ) : (
                    <p className="border-t border-arena px-3.5 py-2.5 text-sm text-humo">Todavía no tiene hembras.</p>
                  )}
                </li>
              );
            })}
          </ul>
          {lotes.length >= MAX_TEMPORADAS ? <p className="text-sm text-humo">Se muestran las {MAX_TEMPORADAS} temporadas más recientes: afina el periodo para ver otras.</p> : null}
        </>
      )}
    </div>
  );
}
