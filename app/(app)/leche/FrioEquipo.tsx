import Link from "next/link";
import { EnlaceBoton } from "@/components/Boton";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { ListaEquipo } from "@/components/ListaEquipo";
import { ListaFrio } from "@/components/ListaFrio";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatoFecha, hoyBogota, sumarDias } from "@/lib/fechas";
import { estadoTemperatura, ETIQUETA_MANTENIMIENTO, ETIQUETA_MOMENTO_FRIO, FRIO_MAX, FRIO_MIN, pendientesMantenimiento, textoPlazo } from "@/lib/leche-calidad";
import type { ControlFrio, MantenimientoOrdeno } from "@/lib/tipos";

/** Cadena de frío y equipo de ordeño: la última temperatura, las tareas que ya tocan y el historial de cada cosa. */
export async function FrioEquipo({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const [frio, tareas] = await Promise.all([
    supabase.from("controles_frio").select("*").eq("finca_id", fincaId).gte("fecha", sumarDias(hoy, -29)).order("fecha", { ascending: false }).order("hora", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("mantenimiento_ordeno").select("*").eq("finca_id", fincaId).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(300),
  ]);

  const mediciones = (frio.data ?? []) as ControlFrio[];
  const ultima = mediciones[0];
  const fuera = mediciones.filter((m) => estadoTemperatura(m.temperatura_c).tono !== "ok").length;
  const estadoUltima = ultima ? estadoTemperatura(ultima.temperatura_c) : null;
  const pendientes = pendientesMantenimiento((tareas.data ?? []) as MantenimientoOrdeno[], hoy);

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="titulo-frio">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-frio" className="font-display text-xl font-semibold">Cadena de frío</h2>
          {puedeEditar ? <EnlaceBoton href="/leche/frio/nuevo" ancho={false}>Medir</EnlaceBoton> : null}
        </div>
        {ultima && estadoUltima ? (
          <Tarjeta>
            <p className="font-display text-3xl font-semibold tabular-nums">{ultima.temperatura_c.toLocaleString("es-CO")} °C</p>
            <p className="text-sm text-humo [overflow-wrap:anywhere]">
              {formatoFecha(ultima.fecha)}
              {ultima.hora ? ` · ${ultima.hora.slice(0, 5)}` : ""} · {ETIQUETA_MOMENTO_FRIO[ultima.momento]}
              {ultima.equipo ? ` · ${ultima.equipo}` : ""}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Insignia tono={estadoUltima.tono}>{estadoUltima.texto}</Insignia>
              <span className="text-humo">
                {fuera === 0
                  ? `Las ${mediciones.length} mediciones de 30 días están entre ${FRIO_MIN} y ${FRIO_MAX} °C`
                  : `${fuera} de ${mediciones.length} mediciones de 30 días fuera de ${FRIO_MIN}–${FRIO_MAX} °C`}
              </span>
            </p>
          </Tarjeta>
        ) : null}
        <ListaFrio fincaId={fincaId} puedeEditar={puedeEditar} />
      </section>

      <section className="space-y-3" aria-labelledby="titulo-equipo">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-equipo" className="font-display text-xl font-semibold">Equipo de ordeño</h2>
          {puedeEditar ? <EnlaceBoton href="/leche/equipo/nuevo" ancho={false}>Registrar</EnlaceBoton> : null}
        </div>
        {pendientes.length > 0 ? (
          <Tarjeta titulo="Por hacer">
            <ul className="divide-y divide-arena">
              {pendientes.map(({ registro: r, dias }) => (
                <li key={r.id}>
                  <Link href={puedeEditar ? `/leche/equipo/${r.id}` : "/leche?vista=frio"} className="flex min-h-12 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-semibold">{ETIQUETA_MANTENIMIENTO[r.tipo]}</span>
                      <span className="block text-sm text-humo">{[r.equipo, `Para el ${formatoFecha(r.proxima_fecha!, { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Insignia tono={dias < 0 ? "alerta" : dias <= 1 ? "aviso" : "neutro"}>{textoPlazo(dias)}</Insignia>
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : (tareas.data ?? []).length > 0 ? (
          <Aviso tipo="exito">No hay tareas del equipo pendientes en los próximos 7 días.</Aviso>
        ) : null}
        <ListaEquipo fincaId={fincaId} puedeEditar={puedeEditar} />
      </section>
    </div>
  );
}
