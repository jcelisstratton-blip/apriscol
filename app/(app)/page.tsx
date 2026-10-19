import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Droplets, Rabbit } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FincaSelector } from "@/components/FincaSelector";
import { Insignia } from "@/components/Insignia";
import { Aviso } from "@/components/Aviso";
import { AvisoCandidatosCeba } from "@/components/AvisoCandidatosCeba";
import { Tarjeta } from "@/components/Tarjeta";
import { AlertasProduccion } from "@/components/AlertasProduccion";
import { esBaja } from "@/lib/produccion";
import { EnlaceBoton } from "@/components/Boton";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { diasHasta, formatoFecha, hoyBogota, litros, sumarDias } from "@/lib/fechas";
import { etiquetaAnimal, saludo } from "@/lib/animal";
import { pesos } from "@/lib/ferias";
import { IconoEvento } from "@/components/IconoEvento";
import { ETIQUETA_EVENTO, estadoDosis, estadoFechaPrograma, nombreEvento } from "@/lib/sanidad";
import type { CandidatoCeba, CuarentenaAlerta, ProgramaSanitarioResumen, SanidadPendiente, ServicioConParto, TipoEvento, UbicacionVista } from "@/lib/tipos";

export const metadata: Metadata = { title: "Hoy" };

export default async function PaginaHoy({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const { clave } = await searchParams;
  const { finca, fincas, rol, perfil } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const verLeche = puedeVer(rol, "leche", finca.plan);
  const verRepro = puedeVer(rol, "reproduccion", finca.plan);
  const verSanidad = puedeVer(rol, "sanidad", finca.plan);
  const verCarne = puedeVer(rol, "carne", finca.plan);

  const activos = () =>
    supabase.from("animales").select("*", { count: "exact", head: true }).eq("finca_id", finca.id).is("deleted_at", null).eq("estado", "activo");

  const [prod, totalActivos, totalHembras, retiro, servicios, tendencia, pendientes, candidatosCeba, programadas] = await Promise.all([
    verLeche
      ? supabase.from("v_produccion_diaria").select("animal_id, litros_tanque, litros_descartados").eq("finca_id", finca.id).eq("fecha", hoy)
      : Promise.resolve({ data: [] as { animal_id: string | null; litros_tanque: number | null; litros_descartados: number | null }[] }),
    activos(),
    activos().eq("sexo", "hembra"),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
    verRepro
      ? supabase
          .from("v_servicios")
          .select("id, hembra_id, fecha, fecha_prevista_parto")
          .eq("finca_id", finca.id)
          .gte("fecha_prevista_parto", hoy)
          .lte("fecha_prevista_parto", sumarDias(hoy, 30))
          .order("fecha_prevista_parto")
      : Promise.resolve({ data: [] as ServicioConParto[] }),
    verLeche ? supabase.rpc("produccion_tendencia", { p_finca: finca.id }) : Promise.resolve({ data: [] }),
    // Dosis vencidas o que se vencen en la próxima semana.
    verSanidad
      ? supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", finca.id).lte("proxima_fecha", sumarDias(hoy, 7)).order("proxima_fecha").limit(1000)
      : Promise.resolve({ data: [] as SanidadPendiente[] }),
    // Animales que conviene pasar a ceba (según las reglas de la finca).
    verCarne ? supabase.rpc("candidatos_ceba", { p_finca: finca.id }) : Promise.resolve({ data: [] as CandidatoCeba[] }),
    // Lo programado en Hato → Sanidad que ya venció o toca en la próxima semana.
    verSanidad
      ? supabase.from("v_programas_sanitarios").select("*").eq("finca_id", finca.id).eq("estado", "abierto").lte("fecha_programada", sumarDias(hoy, 7)).order("fecha_programada").limit(20)
      : Promise.resolve({ data: [] as ProgramaSanitarioResumen[] }),
  ]);

  // Gastos por pagar que ya vencieron (Hato → Gastos): solo quien maneja costos.
  const verGastos = puedeVer(rol, "contabilidad", finca.plan);
  // Ventas cuyo cobro esperado ya pasó: la leche, los animales y lo demás que se vendió.
  const cobrosVencidos = verGastos ? ((await supabase.rpc("ventas_pagina", { p_finca: finca.id, p_desde: null, p_hasta: null, p_linea: null, p_limite: 200, p_salto: 0 })).data ?? []).filter((v) => !v.cobrado && v.cobro_vence !== null && v.cobro_vence < hoy) : [];
  const gastosVencidos = verGastos ? ((await supabase.from("gastos").select("id, descripcion, monto, vence").eq("finca_id", finca.id).is("pagado_en", null).lt("vence", hoy).order("vence").limit(50)).data ?? []) : [];

  // Corrales: hacinamiento, potreros que deben desocuparse y animales comprados sin cuarentena (Hato → Corrales).
  const verCorrales = puedeVer(rol, "corrales", finca.plan);
  const [ubicacionesAlerta, cuarentenaAlerta] = verCorrales
    ? await Promise.all([
        supabase.from("v_ubicaciones").select("*").eq("finca_id", finca.id).eq("activa", true).or("hacinada.eq.true,estado.eq.debe_salir").limit(50),
        supabase.from("v_cuarentena_alerta").select("*").eq("finca_id", finca.id).eq("situacion", "falta_cuarentena").limit(200),
      ])
    : [{ data: [] as UbicacionVista[] }, { data: [] as CuarentenaAlerta[] }];
  const alertasCorrales = (ubicacionesAlerta.data ?? []) as UbicacionVista[];
  const sinCuarentena = (cuarentenaAlerta.data ?? []) as CuarentenaAlerta[];

  // Las dosis por aplicar se agrupan por el evento que las programó.
  const dosisGrupos = new Map<string, { evento_id: string; tipo: TipoEvento | null; producto_nombre: string | null; proxima_fecha: string; animales: string[] }>();
  for (const p of (pendientes.data ?? []) as SanidadPendiente[]) {
    if (!p.evento_id || !p.animal_id || !p.proxima_fecha) continue;
    const g = dosisGrupos.get(p.evento_id) ?? { evento_id: p.evento_id, tipo: p.tipo, producto_nombre: p.producto_nombre, proxima_fecha: p.proxima_fecha, animales: [] };
    g.animales.push(p.animal_id);
    dosisGrupos.set(p.evento_id, g);
  }
  const dosisPorAplicar = [...dosisGrupos.values()];

  // Un servicio ya no cuenta como «parto próximo» si la hembra parió después de él.
  const serviciosData = (servicios.data ?? []) as ServicioConParto[];
  const hembrasServ = [...new Set(serviciosData.map((s) => s.hembra_id).filter((x): x is string => !!x))];
  const partos = hembrasServ.length
    ? (await supabase.from("partos").select("madre_id, fecha").in("madre_id", hembrasServ).gte("fecha", serviciosData.reduce((m, s) => (s.fecha && s.fecha < m ? s.fecha : m), hoy))).data ?? []
    : [];
  const proximos = serviciosData.filter(
    (s) => !partos.some((p) => p.madre_id === s.hembra_id && s.fecha && p.fecha >= s.fecha),
  );

  const enRetiro = retiro.data ?? [];
  const tendenciasBaja = (tendencia.data ?? []).filter(esBaja);
  const idsNombres = [
    ...new Set([
      ...enRetiro.map((r) => r.animal_id),
      ...proximos.map((p) => p.hembra_id).filter((x): x is string => !!x),
      ...tendenciasBaja.map((t) => t.animal_id),
      ...dosisPorAplicar.slice(0, 4).filter((g) => g.animales.length === 1).map((g) => g.animales[0]),
    ]),
  ];
  const nombres = new Map<string, string>();
  if (idsNombres.length) {
    const { data } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", idsNombres);
    (data ?? []).forEach((a) => nombres.set(a.id, etiquetaAnimal(a)));
  }

  const alertasProduccion = tendenciasBaja.map((t) => ({ ...t, etiqueta: nombres.get(t.animal_id) ?? "Animal" }));
  const filasProd = prod.data ?? [];
  const litrosTanque = filasProd.reduce((s, f) => s + Number(f.litros_tanque ?? 0), 0);
  const litrosDescartados = filasProd.reduce((s, f) => s + Number(f.litros_descartados ?? 0), 0);
  const animalesOrdenados = new Set(filasProd.map((f) => f.animal_id)).size;
  const hato = totalActivos.count ?? 0;
  const hembras = totalHembras.count ?? 0;

  const nombrePila = (perfil?.nombre ?? "").split(" ")[0];

  return (
    <>
      <Encabezado
        titulo={nombrePila ? `${saludo()}, ${nombrePila}` : saludo()}
        subtitulo={formatoFecha(hoy, { weekday: "long", day: "numeric", month: "long" })}
      />
      {clave === "cambiada" ? <Aviso tipo="exito" className="mb-3">Tu contraseña quedó actualizada.</Aviso> : null}
      <div className="mb-4 lg:hidden">
        <FincaSelector fincas={fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol }))} activa={finca.id} />
      </div>

      {hato === 0 ? (
        <Tarjeta className="lg:max-w-xl">
          <EstadoVacio
            icono={<Rabbit strokeWidth={1.5} />}
            titulo="Empecemos por el hato"
            descripcion="Registra tu primer animal y desde ahí vas sumando ordeños, partos y sanidad."
          >
            {puedeEscribir(rol, "hato", finca.plan) ? <EnlaceBoton href="/hato/nuevo">Registrar animal</EnlaceBoton> : null}
          </EstadoVacio>
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:items-start">
          {verLeche ? (
            <section className="rounded-3xl bg-musgo p-5 text-sobre-musgo">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold opacity-85">Leche de hoy</p>
                <Droplets className="size-5 opacity-80" strokeWidth={1.75} />
              </div>
              <p className="mt-1 font-display text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums">
                {litros(litrosTanque)}
                <span className="ml-1.5 text-xl font-medium opacity-80">L</span>
              </p>
              <p className="mt-2 text-[0.9375rem] opacity-90">
                {animalesOrdenados === 0
                  ? "Todavía no hay ordeños registrados hoy."
                  : `${animalesOrdenados} ${animalesOrdenados === 1 ? "animal ordeñado" : "animales ordeñados"}${
                      litrosDescartados > 0 ? ` · ${litros(litrosDescartados)} L descartados` : ""
                    }`}
              </p>
              {puedeEscribir(rol, "leche", finca.plan) ? (
                <Link
                  href="/hato?vista=ordeno"
                  className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-sobre-musgo/15 px-4 text-sm font-semibold"
                >
                  Registrar ordeño <ChevronRight className="size-4" strokeWidth={2} />
                </Link>
              ) : null}
            </section>
          ) : null}

          {verLeche ? <AlertasProduccion alertas={alertasProduccion} limite={5} /> : null}

          {verCarne ? (
            <AvisoCandidatosCeba
              tocan={(candidatosCeba.data ?? []).filter((c) => c.nivel === "toca").length}
              proximos={(candidatosCeba.data ?? []).filter((c) => c.nivel === "proxima").length}
            />
          ) : null}

          <Tarjeta>
            <dl className="grid grid-cols-3 divide-x divide-arena text-center">
              {[
                ["Animales", hato],
                ["Hembras", hembras],
                ["Machos", hato - hembras],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0 px-1">
                  <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                  <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
                </div>
              ))}
            </dl>
          </Tarjeta>

          {(programadas.data ?? []).length > 0 ? (
            <Tarjeta titulo="Sanidad programada" acciones={<Link href="/hato?vista=sanidad" className="text-sm font-semibold text-musgo">Ver Hato → Sanidad</Link>}>
              <ul className="divide-y divide-arena">
                {(programadas.data as ProgramaSanitarioResumen[]).slice(0, 4).map((p) => {
                  const e = estadoFechaPrograma(p.fecha_programada, hoy);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <IconoEvento tipo={p.tipo} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold [overflow-wrap:anywhere]">{p.producto_nombre?.trim() || ETIQUETA_EVENTO[p.tipo]}</span>
                        <span className="block text-sm text-humo">
                          {ETIQUETA_EVENTO[p.tipo]} · {p.animales - p.aplicados} {p.animales - p.aplicados === 1 ? "animal" : "animales"}
                        </span>
                        <span className="mt-1 block"><Insignia tono={e.tono}>{e.texto}</Insignia></span>
                      </span>
                      {puedeEscribir(rol, "sanidad", finca.plan) ? (
                        <Link href={`/hato/sanidad/nuevo?programa=${p.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                          Aplicar
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {(programadas.data ?? []).length > 4 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {(programadas.data ?? []).length - 4} más en Hato → Sanidad.</p> : null}
            </Tarjeta>
          ) : null}

          {dosisPorAplicar.length > 0 ? (
            <Tarjeta titulo="Dosis por aplicar" acciones={<Link href="/sanidad" className="text-sm font-semibold text-musgo">Ver Sanidad</Link>}>
              <ul className="divide-y divide-arena">
                {dosisPorAplicar.slice(0, 4).map((g) => {
                  const e = estadoDosis(g.proxima_fecha, hoy);
                  return (
                    <li key={g.evento_id} className="flex items-center gap-3 py-2.5">
                      <IconoEvento tipo={g.tipo} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold [overflow-wrap:anywhere]">{nombreEvento(g)}</span>
                        <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                          {g.tipo ? ETIQUETA_EVENTO[g.tipo] : ""} · {g.animales.length === 1 ? (nombres.get(g.animales[0]) ?? "1 animal") : `${g.animales.length} animales`}
                        </span>
                        <span className="mt-1 block"><Insignia tono={e.tono}>{e.texto}</Insignia></span>
                      </span>
                      {puedeEscribir(rol, "sanidad", finca.plan) ? (
                        <Link href={`/hato/sanidad/nuevo?refuerzo=${g.evento_id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                          Aplicar
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {dosisPorAplicar.length > 4 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {dosisPorAplicar.length - 4} más en Sanidad.</p> : null}
            </Tarjeta>
          ) : null}

          {enRetiro.length > 0 ? (
            <Tarjeta titulo="En periodo de retiro">
              <ul className="divide-y divide-arena">
                {enRetiro.map((r) => (
                  <li key={r.animal_id}>
                    <Link href={`/hato/${r.animal_id}#sanidad`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      <span className="min-w-0 font-semibold">{nombres.get(r.animal_id) ?? "Animal"}</span>
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

          {gastosVencidos.length > 0 ? (
            <Tarjeta titulo="Compras por pagar vencidas" acciones={<Link href="/hato?vista=gastos" className="text-sm font-semibold text-musgo">Ver Hato → Compras</Link>}>
              <p className="font-display text-2xl font-semibold tabular-nums">{pesos(gastosVencidos.reduce((s, g) => s + Number(g.monto), 0))}</p>
              <ul className="mt-2 divide-y divide-arena">
                {gastosVencidos.slice(0, 4).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">{g.descripcion}</span>
                      <span className="block text-sm text-humo">Venció hace {-diasHasta(g.vence!, hoy)} {-diasHasta(g.vence!, hoy) === 1 ? "día" : "días"}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{pesos(Number(g.monto))}</span>
                  </li>
                ))}
              </ul>
              {gastosVencidos.length > 4 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {gastosVencidos.length - 4} más en Hato → Compras.</p> : null}
            </Tarjeta>
          ) : null}

          {cobrosVencidos.length > 0 ? (
            <Tarjeta titulo="Ventas por cobrar vencidas" acciones={<Link href="/hato?vista=ventas" className="text-sm font-semibold text-musgo">Ver Hato → Ventas</Link>}>
              <p className="font-display text-2xl font-semibold tabular-nums">{pesos(cobrosVencidos.reduce((s, v) => s + Number(v.valor), 0))}</p>
              <ul className="mt-2 divide-y divide-arena">
                {cobrosVencidos.slice(0, 4).map((v) => (
                  <li key={`${v.origen}-${v.origen_id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">{v.producto}{v.tercero ? ` · ${v.tercero}` : ""}</span>
                      <span className="block text-sm text-humo">Lo esperabas hace {-diasHasta(v.cobro_vence!, hoy)} {-diasHasta(v.cobro_vence!, hoy) === 1 ? "día" : "días"}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{pesos(Number(v.valor))}</span>
                  </li>
                ))}
              </ul>
              {cobrosVencidos.length > 4 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {cobrosVencidos.length - 4} más en Hato → Ventas.</p> : null}
            </Tarjeta>
          ) : null}

          {alertasCorrales.length > 0 || sinCuarentena.length > 0 ? (
            <Tarjeta titulo="Corrales" acciones={<Link href="/hato?vista=corrales" className="text-sm font-semibold text-musgo">Ver Hato → Corrales</Link>}>
              <ul className="space-y-1.5 text-[0.9375rem]">
                {alertasCorrales.slice(0, 5).map((u) => (
                  <li key={u.id}>
                    <Link href={`/hato/corrales/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.nombre}</Link>
                    {u.hacinada ? ` tiene ${u.ocupantes} animales y le caben ${u.capacidad}.` : ` lleva ${u.dias_ocupacion} días ocupado: el lote debe pasar a otro potrero.`}
                  </li>
                ))}
                {sinCuarentena.length > 0 ? (
                  <li>
                    {sinCuarentena.length} {sinCuarentena.length === 1 ? "animal comprado reciente no ha pasado" : "animales comprados recientes no han pasado"} por cuarentena.
                  </li>
                ) : null}
              </ul>
              {alertasCorrales.length > 5 ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {alertasCorrales.length - 5} más en Hato → Corrales.</p> : null}
            </Tarjeta>
          ) : null}

          {proximos.length > 0 ? (
            <Tarjeta titulo="Partos en los próximos 30 días">
              <ul className="divide-y divide-arena">
                {proximos.map((p) => {
                  const dias = diasHasta(p.fecha_prevista_parto!, hoy);
                  return (
                    <li key={p.id}>
                      <Link href={`/hato/${p.hembra_id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 font-semibold">{nombres.get(p.hembra_id!) ?? "Hembra"}</span>
                        <span className="shrink-0 text-right text-sm text-humo">
                          {formatoFecha(p.fecha_prevista_parto, { day: "numeric", month: "short" })}
                          <span className="block font-semibold text-tinta">{dias === 0 ? "Hoy" : `en ${dias} ${dias === 1 ? "día" : "días"}`}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          ) : null}
        </div>
      )}
    </>
  );
}
