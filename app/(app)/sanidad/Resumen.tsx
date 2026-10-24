import Link from "next/link";
import { CalendarClock, ChevronRight, SearchX, Syringe } from "lucide-react";
import { AvisoFamacha } from "@/components/AvisoFamacha";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { textoPlazo } from "@/lib/ajustes";
import { ESCENA_EVENTO, ESCENA_TODOS_TIPOS } from "@/lib/escenas-sanidad";
import { contarFamacha } from "@/lib/famacha";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { rangoPeriodo, type Periodo } from "@/lib/periodos";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, TIPOS_EVENTO, TONO_RESULTADO_PRUEBA, estadoDosis, estadoFechaPrograma, nombreEvento, conRevisionAtrasada, plazosRevisionPezuna } from "@/lib/sanidad";
import type { EventoResumen, ProgramaSanitarioResumen, SanidadPendiente, TipoEvento } from "@/lib/tipos";

export type FiltrosSanidad = { periodo: Periodo; desde?: string; hasta?: string; tipo: TipoEvento | "todos" };

type Grupo = { evento_id: string; tipo: TipoEvento | null; producto_nombre: string | null; proxima_fecha: string; animales: string[] };

/** La dirección del resumen con los filtros puestos (los que no se tocan se conservan). */
function direccion(f: FiltrosSanidad, cambios: Partial<FiltrosSanidad>): string {
  const n = { ...f, ...cambios };
  const q = new URLSearchParams();
  if (n.tipo !== "todos") q.set("tipo", n.tipo);
  if (n.periodo !== "todo") q.set("periodo", n.periodo);
  if (n.periodo === "rango") {
    if (n.desde) q.set("desde", n.desde);
    if (n.hasta) q.set("hasta", n.hasta);
  }
  const t = q.toString();
  return t ? `/sanidad?${t}` : "/sanidad";
}

/**
 * Sanidad → Resumen: lo que ha pasado en la finca en el periodo elegido (aplicaciones por tipo, programaciones, pruebas) y lo que hay que
 * atender ahora (retiros, dosis por aplicar). Es un resumen: programar y aplicar se hace en Hato → Sanidad.
 */
export async function Resumen({
  fincaId,
  filtros,
  puedeProgramar = false,
  cliente,
}: {
  fincaId: string;
  filtros: FiltrosSanidad;
  /** Si la persona puede programar sanidad (muestra el atajo para programar a partir de FAMACHA). */
  puedeProgramar?: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const rango = rangoPeriodo(filtros.periodo, hoy, filtros.desde, filtros.hasta);
  const hayRango = Boolean(rango.desde || rango.hasta);

  let qEventos = supabase.from("v_eventos_sanitarios").select("*").eq("finca_id", fincaId);
  let qProgramas = supabase.from("v_programas_sanitarios").select("*").eq("finca_id", fincaId).neq("estado", "cancelado");
  let qPruebas = supabase.from("pruebas_sanitarias").select("id, animal_id, prueba, fecha, resultado").eq("finca_id", fincaId).in("resultado", ["positivo", "sospechoso"]);
  let qRefuerzos = supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", fincaId);
  if (filtros.tipo !== "todos") {
    qEventos = qEventos.eq("tipo", filtros.tipo);
    qProgramas = qProgramas.eq("tipo", filtros.tipo);
    qRefuerzos = qRefuerzos.eq("tipo", filtros.tipo);
  }
  if (rango.desde) {
    qEventos = qEventos.gte("fecha", rango.desde);
    qProgramas = qProgramas.gte("fecha_programada", rango.desde);
    qPruebas = qPruebas.gte("fecha", rango.desde);
    qRefuerzos = qRefuerzos.gte("proxima_fecha", rango.desde);
  }
  if (rango.hasta) {
    qEventos = qEventos.lte("fecha", rango.hasta);
    qProgramas = qProgramas.lte("fecha_programada", rango.hasta);
    qPruebas = qPruebas.lte("fecha", rango.hasta);
    qRefuerzos = qRefuerzos.lte("proxima_fecha", rango.hasta);
  }

  const { general: ajustes } = await obtenerAjustes();
  const [retiro, eventosDB, programasDB, pruebasDB, refuerzosDB, podologiaDB, pediluvioDB, famachaDB] = await Promise.all([
    supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
    qEventos.order("fecha", { ascending: false }).limit(1000),
    qProgramas.order("fecha_programada").limit(500),
    qPruebas.order("fecha", { ascending: false }).limit(8),
    qRefuerzos.order("proxima_fecha").limit(1000),
    supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000),
    supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000),
    supabase.from("v_famacha_animal").select("*").eq("finca_id", fincaId).gte("puntaje", 3).limit(2000),
  ]);

  const eventos = (eventosDB.data ?? []) as EventoResumen[];
  const programas = (programasDB.data ?? []) as ProgramaSanitarioResumen[];
  const abiertas = programas.filter((p) => p.estado === "abierto");
  const vencidas = abiertas.filter((p) => p.fecha_programada < hoy).length;
  const aplicaciones = eventos.reduce((s, e) => s + Number(e.animales ?? 0), 0);
  const porTipo = new Map<TipoEvento, number>();
  for (const e of eventos) if (e.tipo) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);
  const maximoTipo = Math.max(1, ...porTipo.values());

  // Las dosis por aplicar se agrupan por el evento que las programó: «Clostridial · 30 animales · vence el 20 de oct».
  const grupos = new Map<string, Grupo>();
  for (const p of (refuerzosDB.data ?? []) as SanidadPendiente[]) {
    if (!p.evento_id || !p.animal_id || !p.proxima_fecha) continue;
    const g = grupos.get(p.evento_id) ?? { evento_id: p.evento_id, tipo: p.tipo, producto_nombre: p.producto_nombre, proxima_fecha: p.proxima_fecha, animales: [] };
    g.animales.push(p.animal_id);
    grupos.set(p.evento_id, g);
  }
  const refuerzos = [...grupos.values()].sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha));

  const enRetiro = (retiro.data ?? []).slice().sort((a, b) => (a.retiro_carne_hasta ?? a.retiro_leche_hasta ?? "").localeCompare(b.retiro_carne_hasta ?? b.retiro_leche_hasta ?? ""));
  const pruebas = pruebasDB.data ?? [];
  const { desparasitar: famachaDesparasitar, vigilar: famachaVigilar } = contarFamacha(famachaDB.data ?? []);
  const { pediluvioDias: diasPediluvio } = plazosRevisionPezuna(ajustes, hoy);
  const sinPodologia = conRevisionAtrasada(podologiaDB.data ?? [], ajustes.podologia_inspeccion_dias, hoy).length;
  const sinPediluvio = conRevisionAtrasada(pediluvioDB.data ?? [], diasPediluvio, hoy).length;

  const nombres = new Map((await animalesPorIds(supabase, fincaId, [...enRetiro.map((r) => r.animal_id), ...pruebas.map((p) => p.animal_id), ...refuerzos.filter((g) => g.animales.length === 1).map((g) => g.animales[0])])).map((a) => [a.id, etiquetaAnimal(a)]));

  const hayTipo = filtros.tipo !== "todos";
  const sinNada = eventos.length === 0 && programas.length === 0 && refuerzos.length === 0 && pruebas.length === 0 && enRetiro.length === 0 && famachaDesparasitar + famachaVigilar === 0;
  const cifras: [string, number, boolean][] = [
    ["Registros", eventos.length, false],
    ["Aplicaciones", aplicaciones, false],
    ["Programadas", abiertas.length, vencidas > 0],
    ["En retiro", enRetiro.length, false],
  ];

  return (
    <div className="space-y-4">
      <FilaTarjetas etiqueta="Tipo de tratamiento">
        <TarjetaOpcion escena={ESCENA_TODOS_TIPOS} titulo="Todos los tipos" href={direccion(filtros, { tipo: "todos" })} activo={filtros.tipo === "todos"} />
        {TIPOS_EVENTO.map((t) => (
          <TarjetaOpcion key={t} escena={ESCENA_EVENTO[t]} titulo={ETIQUETA_EVENTO[t]} href={direccion(filtros, { tipo: t })} activo={filtros.tipo === t} />
        ))}
      </FilaTarjetas>

      {sinNada ? (
        hayRango || hayTipo ? (
          <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con ese filtro" descripcion="No hay aplicaciones, programaciones ni pruebas en este periodo. Prueba con otro periodo o con otro tipo.">
            <Link href="/sanidad" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Quitar los filtros
            </Link>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono={<Syringe strokeWidth={1.5} />} titulo="Todavía no hay sanidad registrada" descripcion="Cuando programes o apliques vacunas, desparasitaciones o tratamientos, aquí verás el resumen, los retiros y las próximas dosis. Se programan en Hato → Sanidad.">
            <Link href="/hato?vista=sanidad" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Ir a Hato → Sanidad
            </Link>
          </EstadoVacio>
        )
      ) : (
        <>
          <Tarjeta>
            <dl className="grid grid-cols-2 gap-y-3 min-[480px]:grid-cols-4 min-[480px]:divide-x min-[480px]:divide-arena">
              {cifras.map(([etiqueta, valor, alerta]) => (
                <div key={etiqueta} className="min-w-0 px-1 text-center">
                  <dd className={`font-display text-2xl font-semibold tabular-nums ${alerta ? "text-rojo" : ""}`}>{valor}</dd>
                  <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
                </div>
              ))}
            </dl>
          </Tarjeta>

          <div className="space-y-3.5 lg:columns-2 lg:gap-x-4 lg:space-y-0 lg:[&>*]:mb-3.5 lg:[&>*]:break-inside-avoid">
            {abiertas.length > 0 ? (
              <Tarjeta titulo="Programadas" acciones={<Link href="/hato?vista=sanidad" className="text-sm font-semibold text-musgo">Hato → Sanidad</Link>}>
                <ul className="divide-y divide-arena">
                  {abiertas.slice(0, 6).map((p) => {
                    const e = estadoFechaPrograma(p.fecha_programada, hoy);
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <IconoEvento tipo={p.tipo} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold [overflow-wrap:anywhere]">{p.producto_nombre?.trim() || ETIQUETA_EVENTO[p.tipo]}</span>
                          <span className="block text-sm text-humo">
                            {ETIQUETA_EVENTO[p.tipo]} · {p.animales - p.aplicados} de {p.animales} {p.animales === 1 ? "animal" : "animales"} por aplicar
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <Insignia tono={e.tono}>{e.texto}</Insignia>
                            <Insignia>{formatoFecha(p.fecha_programada, { day: "numeric", month: "short" })}</Insignia>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {abiertas.length > 6 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {abiertas.length - 6} más en Hato → Sanidad.</p> : null}
              </Tarjeta>
            ) : null}

            {eventos.length > 0 ? (
              <Tarjeta titulo="Lo aplicado en el periodo">
                <ul className="space-y-2">
                  {[...porTipo.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, n]) => (
                      <li key={t} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-sm font-semibold">{ETIQUETA_EVENTO[t]}</span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-arena" aria-hidden="true">
                          <span className="block h-full rounded-full bg-musgo" style={{ width: `${Math.max(6, (n / maximoTipo) * 100)}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right text-sm tabular-nums text-humo">{n}</span>
                      </li>
                    ))}
                </ul>
                <ul className="mt-3 divide-y divide-arena border-t border-arena">
                  {eventos.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      <Link href={`/sanidad/evento/${e.id}`} className="flex min-h-14 items-center gap-3 py-2">
                        <IconoEvento tipo={e.tipo} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold [overflow-wrap:anywhere]">{nombreEvento(e)}</span>
                          <span className="block text-sm text-humo">
                            {formatoFecha(e.fecha, { day: "numeric", month: "short", year: "numeric" })} · {(e.animales ?? 0) === 1 ? (e.primer_animal ?? "1 animal") : `${e.animales ?? 0} animales`}
                          </span>
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={direccionHistorial(filtros)} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  Ver todo el historial{eventos.length > 6 ? ` (${eventos.length})` : ""}
                </Link>
              </Tarjeta>
            ) : null}

            {refuerzos.length > 0 ? (
              <Tarjeta titulo="Dosis por aplicar">
                <ul className="divide-y divide-arena">
                  {refuerzos.slice(0, 8).map((g) => {
                    const e = estadoDosis(g.proxima_fecha, hoy);
                    const cuantos = g.animales.length === 1 ? (nombres.get(g.animales[0]) ?? "1 animal") : `${g.animales.length} animales`;
                    return (
                      <li key={g.evento_id} className="flex items-center gap-3 py-2.5">
                        <IconoEvento tipo={g.tipo} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold [overflow-wrap:anywhere]">{nombreEvento(g)}</span>
                          <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                            {g.tipo ? ETIQUETA_EVENTO[g.tipo] : ""} · {cuantos}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <Insignia tono={e.tono}>{e.texto}</Insignia>
                            <Insignia>{formatoFecha(g.proxima_fecha, { day: "numeric", month: "short" })}</Insignia>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {refuerzos.length > 8 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {refuerzos.length - 8} más.</p> : null}
                <Link href="/hato?vista=sanidad" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  Aplicarlas en Hato → Sanidad
                </Link>
              </Tarjeta>
            ) : null}

            {enRetiro.length > 0 ? (
              <Tarjeta titulo="En periodo de retiro (ahora)">
                <ul className="divide-y divide-arena">
                  {enRetiro.map((r) => (
                    <li key={r.animal_id}>
                      <Link href={`/hato/${r.animal_id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{nombres.get(r.animal_id) ?? "Animal"}</span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {r.retiro_leche_hasta ? <Insignia tono="aviso">Leche hasta {formatoFecha(r.retiro_leche_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                          {r.retiro_carne_hasta ? <Insignia tono="alerta">Carne hasta {formatoFecha(r.retiro_carne_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ) : null}

            {pruebas.length > 0 ? (
              <Tarjeta titulo="Pruebas por revisar">
                <ul className="divide-y divide-arena">
                  {pruebas.map((p) => (
                    <li key={p.id}>
                      <Link href={`/hato/${p.animal_id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block font-semibold [overflow-wrap:anywhere]">{nombres.get(p.animal_id) ?? "Animal"}</span>
                          <span className="block text-sm text-humo">
                            {ETIQUETA_PRUEBA_CORTA[p.prueba]} · {formatoFecha(p.fecha, { day: "numeric", month: "short" })}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Insignia tono={TONO_RESULTADO_PRUEBA[p.resultado]}>{ETIQUETA_RESULTADO_PRUEBA[p.resultado]}</Insignia>
                          <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ) : null}

            {(famachaDesparasitar > 0 || famachaVigilar > 0) && (filtros.tipo === "todos" || filtros.tipo === "desparasitacion") ? (
              <Tarjeta titulo="FAMACHA (ahora)">
                <AvisoFamacha desparasitar={famachaDesparasitar} vigilar={famachaVigilar} puedeProgramar={puedeProgramar} />
              </Tarjeta>
            ) : null}

            {sinPodologia > 0 && (filtros.tipo === "todos" || filtros.tipo === "podologia") ? (
              <Tarjeta titulo="Podología">
                <p className="text-[0.9375rem] text-humo">
                  {sinPodologia} {sinPodologia === 1 ? "animal lleva" : "animales llevan"} más de {textoPlazo(ajustes.podologia_inspeccion_dias)} sin recorte de pezuñas registrado. La inspección periódica previene cojeras y gabatillo.
                </p>
                <Link href="/hato/sanidad/programar?tipo=podologia&grupo=podologia" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  <CalendarClock className="size-4" strokeWidth={2} aria-hidden="true" /> Programar podología
                </Link>
              </Tarjeta>
            ) : null}

            {sinPediluvio > 0 && (filtros.tipo === "todos" || filtros.tipo === "pediluvio") ? (
              <Tarjeta titulo="Pediluvio">
                <p className="text-[0.9375rem] text-humo">
                  {sinPediluvio} {sinPediluvio === 1 ? "animal lleva" : "animales llevan"} más de {textoPlazo(diasPediluvio)} sin baño de patas registrado.
                </p>
                <Link href="/hato/sanidad/programar?tipo=pediluvio&grupo=pediluvio" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  <CalendarClock className="size-4" strokeWidth={2} aria-hidden="true" /> Programar pediluvio
                </Link>
              </Tarjeta>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/** El historial con los mismos filtros que tiene el resumen. */
function direccionHistorial(f: FiltrosSanidad): string {
  const q = new URLSearchParams({ vista: "historial" });
  if (f.tipo !== "todos") q.set("tipo", f.tipo);
  if (f.periodo !== "todo") q.set("periodo", f.periodo);
  if (f.periodo === "rango") {
    if (f.desde) q.set("desde", f.desde);
    if (f.hasta) q.set("hasta", f.hasta);
  }
  return `/sanidad?${q.toString()}`;
}
