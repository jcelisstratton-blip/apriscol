import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Fence, SearchX } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { TarjetaUbicacion } from "@/components/TarjetaUbicacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_MOTIVO, MOTIVOS, estadoCuarentena } from "@/lib/corrales";
import { ESCENA_MOTIVO, ESCENA_TODOS_MOTIVOS } from "@/lib/escenas-corrales";
import { hoyBogota } from "@/lib/fechas";
import { rangoPeriodo, type Periodo } from "@/lib/periodos";
import type { CuarentenaAlerta, MotivoMovimiento, UbicacionVista } from "@/lib/tipos";

export type FiltrosCorrales = { periodo: Periodo; desde?: string; hasta?: string; motivo: MotivoMovimiento | "todos" };

/** La dirección del resumen con los filtros puestos (los que no se tocan se conservan). */
function direccion(f: FiltrosCorrales, cambios: Partial<FiltrosCorrales>, vista?: string): string {
  const n = { ...f, ...cambios };
  const q = new URLSearchParams();
  if (vista) q.set("vista", vista);
  if (n.motivo !== "todos") q.set("motivo", n.motivo);
  if (n.periodo !== "todo") q.set("periodo", n.periodo);
  if (n.periodo === "rango") {
    if (n.desde) q.set("desde", n.desde);
    if (n.hasta) q.set("hasta", n.hasta);
  }
  const t = q.toString();
  return t ? `/corrales?${t}` : "/corrales";
}

/**
 * Corrales → Resumen: los movimientos de animales en el periodo elegido (cuántos, por qué motivo) y cómo están las instalaciones ahora
 * (ocupación, hacinamiento, rotación de potreros, cuarentena). Es un resumen: crear instalaciones y mover animales se hace en Hato → Corrales.
 */
export async function Resumen({
  fincaId,
  filtros,
  cliente,
}: {
  fincaId: string;
  filtros: FiltrosCorrales;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const rango = rangoPeriodo(filtros.periodo, hoy, filtros.desde, filtros.hasta);
  const hayRango = Boolean(rango.desde || rango.hasta);
  const hayMotivo = filtros.motivo !== "todos";

  let qMov = supabase.from("movimientos_animales").select("animal_id, motivo, desde, ubicacion_id").eq("finca_id", fincaId);
  if (filtros.motivo !== "todos") qMov = qMov.eq("motivo", filtros.motivo);
  if (rango.desde) qMov = qMov.gte("desde", rango.desde);
  if (rango.hasta) qMov = qMov.lte("desde", rango.hasta);

  const [movDB, ubicacionesDB, cuarentenaDB] = await Promise.all([
    qMov.order("desde", { ascending: false }).limit(2000),
    supabase.from("v_ubicaciones").select("*").eq("finca_id", fincaId).eq("activa", true).order("tipo").order("nombre").limit(300),
    supabase.from("v_cuarentena_alerta").select("*").eq("finca_id", fincaId).limit(500),
  ]);

  const movimientos = movDB.data ?? [];
  const ubicaciones = (ubicacionesDB.data ?? []) as UbicacionVista[];
  const corrales = ubicaciones.filter((u) => u.tipo === "corral");
  const potreros = ubicaciones.filter((u) => u.tipo === "potrero");
  const cuarentena = (cuarentenaDB.data ?? []) as CuarentenaAlerta[];
  const enCuarentena = cuarentena.filter((c) => c.situacion === "en_cuarentena").sort((a, b) => b.dias - a.dias);
  const faltaCuarentena = cuarentena.filter((c) => c.situacion === "falta_cuarentena");
  const hacinadas = ubicaciones.filter((u) => u.hacinada);
  const debenSalir = potreros.filter((u) => u.estado === "debe_salir");

  const porMotivo = new Map<MotivoMovimiento, number>();
  for (const m of movimientos) porMotivo.set(m.motivo, (porMotivo.get(m.motivo) ?? 0) + 1);
  const maximoMotivo = Math.max(1, ...porMotivo.values());
  const animalesMovidos = new Set(movimientos.map((m) => m.animal_id)).size;
  const nombres = new Map((await animalesPorIds(supabase, fincaId, [...enCuarentena.map((c) => c.animal_id), ...faltaCuarentena.map((c) => c.animal_id)])).map((a) => [a.id, etiquetaAnimal(a)]));

  const sinNada = ubicaciones.length === 0 && movimientos.length === 0;
  const cifras: [string, number, boolean][] = [
    ["Movimientos", movimientos.length, false],
    ["Animales movidos", animalesMovidos, false],
    ["Instalaciones", ubicaciones.length, false],
    ["Hacinadas", hacinadas.length, hacinadas.length > 0],
  ];
  const hayAlertas = hacinadas.length > 0 || debenSalir.length > 0 || faltaCuarentena.length > 0 || enCuarentena.length > 0;

  return (
    <div className="space-y-4">
      <FilaTarjetas etiqueta="Motivo del movimiento">
        <TarjetaOpcion escena={ESCENA_TODOS_MOTIVOS} titulo="Todos los motivos" href={direccion(filtros, { motivo: "todos" })} activo={filtros.motivo === "todos"} />
        {MOTIVOS.map((m) => (
          <TarjetaOpcion key={m} escena={ESCENA_MOTIVO[m]} titulo={ETIQUETA_MOTIVO[m]} href={direccion(filtros, { motivo: m })} activo={filtros.motivo === m} />
        ))}
      </FilaTarjetas>

      {sinNada ? (
        hayRango || hayMotivo ? (
          <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con ese filtro" descripcion="No hay movimientos en este periodo. Prueba con otro periodo o con otro motivo.">
            <Link href="/corrales" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Quitar los filtros
            </Link>
          </EstadoVacio>
        ) : (
          <EstadoVacio
            icono={<Fence strokeWidth={1.5} />}
            titulo="Todavía no hay corrales ni potreros"
            descripcion="Cuando crees tus instalaciones y muevas animales, aquí verás el resumen: ocupación, hacinamiento, rotación de potreros y cuarentena. Se crean en Hato → Corrales."
          >
            <Link href="/hato?vista=corrales" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
              Ir a Hato → Corrales
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
            {hayAlertas ? (
              <Tarjeta
                titulo="Para revisar (ahora)"
                acciones={<AlertTriangle className="size-5 text-ocre" strokeWidth={1.9} aria-hidden="true" />}
              >
                <ul className="space-y-1.5 text-[0.9375rem]">
                  {hacinadas.map((u) => (
                    <li key={u.id}>
                      <Link href={`/hato/corrales/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.nombre}</Link> tiene {u.ocupantes} animales y le caben {u.capacidad}.
                    </li>
                  ))}
                  {debenSalir.map((u) => (
                    <li key={u.id}>
                      <Link href={`/hato/corrales/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.nombre}</Link> lleva {u.dias_ocupacion} días ocupado (máximo {u.dias_ocupacion_max}): el lote debe pasar a otro potrero.
                    </li>
                  ))}
                  {faltaCuarentena.length > 0 ? (
                    <li>
                      {faltaCuarentena.length} {faltaCuarentena.length === 1 ? "animal comprado" : "animales comprados"} en los últimos 30 días {faltaCuarentena.length === 1 ? "no ha pasado" : "no han pasado"} por cuarentena:{" "}
                      {faltaCuarentena.slice(0, 3).map((c) => nombres.get(c.animal_id) ?? "Animal").join(", ")}
                      {faltaCuarentena.length > 3 ? ` y ${faltaCuarentena.length - 3} más` : ""}.
                    </li>
                  ) : null}
                </ul>
                {enCuarentena.length > 0 ? (
                  <div className="mt-2 border-t border-arena pt-2">
                    <p className="text-sm font-semibold">En cuarentena ({enCuarentena.length})</p>
                    <ul className="mt-1 divide-y divide-arena">
                      {enCuarentena.slice(0, 8).map((c) => {
                        const e = estadoCuarentena(c.dias);
                        return (
                          <li key={c.animal_id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5">
                            <Link href={`/hato/${c.animal_id}#ubicacion`} className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere] hover:underline">{nombres.get(c.animal_id) ?? "Animal"}</Link>
                            <Insignia tono={e.tono}>{e.texto}</Insignia>
                          </li>
                        );
                      })}
                    </ul>
                    {enCuarentena.length > 8 ? <p className="mt-1 text-sm text-humo">Y {enCuarentena.length - 8} más.</p> : null}
                  </div>
                ) : null}
              </Tarjeta>
            ) : null}

            {movimientos.length > 0 ? (
              <Tarjeta titulo="Movimientos del periodo" acciones={<Link href={direccion(filtros, {}, "movimientos")} className="text-sm font-semibold text-musgo">Ver todos</Link>}>
                <ul className="space-y-2">
                  {[...porMotivo.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([m, n]) => (
                      <li key={m} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-sm font-semibold">{ETIQUETA_MOTIVO[m]}</span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-arena" aria-hidden="true">
                          <span className="block h-full rounded-full bg-musgo" style={{ width: `${Math.max(6, (n / maximoMotivo) * 100)}%` }} />
                        </span>
                        <span className="w-10 shrink-0 text-right text-sm tabular-nums text-humo">{n}</span>
                      </li>
                    ))}
                </ul>
              </Tarjeta>
            ) : hayRango || hayMotivo ? (
              <Tarjeta titulo="Movimientos del periodo">
                <p className="flex items-center gap-2 text-[0.9375rem] text-humo">
                  <ArrowRightLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> No hubo movimientos con este filtro.
                </p>
              </Tarjeta>
            ) : null}
          </div>

          {corrales.length > 0 ? (
            <section className="space-y-2" aria-label="Corrales">
              <h2 className="font-display text-lg font-semibold">Corrales (ocupación ahora)</h2>
              <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {corrales.map((u) => (
                  <TarjetaUbicacion key={u.id} u={u} puedeEditar={false} />
                ))}
              </ul>
            </section>
          ) : null}

          {potreros.length > 0 ? (
            <section className="space-y-2" aria-label="Potreros">
              <h2 className="font-display text-lg font-semibold">Potreros y rotación (ahora)</h2>
              <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {potreros.map((u) => (
                  <TarjetaUbicacion key={u.id} u={u} puedeEditar={false} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
