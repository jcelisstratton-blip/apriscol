import Link from "next/link";
import { CalendarClock, Footprints, Plus, Syringe } from "lucide-react";
import { AvisoFamacha } from "@/components/AvisoFamacha";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { CancelarPrograma } from "@/components/AccionesPrograma";
import { clasesBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ayudaSanidad } from "@/lib/ayuda";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { diasEntrePediluvios, mesDeFecha, textoPlazo } from "@/lib/ajustes";
import { estadoFamacha } from "@/lib/famacha";
import { formatoFecha, hoyBogota, sumarDias } from "@/lib/fechas";
import { ETIQUETA_EVENTO, estadoDosis, estadoFechaPrograma, nombreEvento } from "@/lib/sanidad";
import type { ProgramaSanitarioResumen, SanidadPendiente, TipoEvento } from "@/lib/tipos";

type GrupoRefuerzo = { evento_id: string; tipo: TipoEvento | null; producto_nombre: string | null; proxima_fecha: string; animales: number };

/**
 * Hato → Sanidad: donde se trabaja la sanidad de varios animales. Se programa una vacuna, desparasitación, tratamiento o podología para los
 * animales que aplican, se aplica cuando llega el día (queda en el historial de cada animal) y se ven las próximas dosis. El resumen de toda la
 * finca, con filtros por fechas, está en el menú «Sanidad».
 */
export async function Sanidad({
  fincaId,
  puedeEditar,
  guardado = false,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  guardado?: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const { general: ajustes } = await obtenerAjustes();
  const limitePodologia = sumarDias(hoy, -ajustes.podologia_inspeccion_dias);
  const diasPediluvio = diasEntrePediluvios(ajustes, mesDeFecha(hoy));
  const limitePediluvio = sumarDias(hoy, -diasPediluvio);
  const [programasDB, pendientesDB, podologiaDB, pediluvioDB, famachaDB] = await Promise.all([
    supabase.from("v_programas_sanitarios").select("*").eq("finca_id", fincaId).eq("estado", "abierto").order("fecha_programada").limit(50),
    supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", fincaId).order("proxima_fecha").limit(1000),
    supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000),
    supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).limit(2000),
    supabase.from("v_famacha_animal").select("*").eq("finca_id", fincaId).gte("puntaje", 3).limit(2000),
  ]);
  const programas = (programasDB.data ?? []) as ProgramaSanitarioResumen[];

  // Las próximas dosis (refuerzos) se agrupan por el evento que las programó: «Clostridial · 30 animales».
  const grupos = new Map<string, GrupoRefuerzo>();
  for (const p of (pendientesDB.data ?? []) as SanidadPendiente[]) {
    if (!p.evento_id || !p.animal_id || !p.proxima_fecha) continue;
    const g = grupos.get(p.evento_id) ?? { evento_id: p.evento_id, tipo: p.tipo, producto_nombre: p.producto_nombre, proxima_fecha: p.proxima_fecha, animales: 0 };
    g.animales += 1;
    grupos.set(p.evento_id, g);
  }
  const refuerzos = [...grupos.values()].sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha));
  const estadosFamacha = (famachaDB.data ?? []).map((f) => estadoFamacha(f).clave);
  const famachaDesparasitar = estadosFamacha.filter((c) => c === "desparasitar").length;
  const famachaVigilar = estadosFamacha.filter((c) => c === "vigilar").length;
  const sinPodologia = (podologiaDB.data ?? []).filter((p) => !p.ultima_fecha || p.ultima_fecha < limitePodologia).length;
  const sinPediluvio = (pediluvioDB.data ?? []).filter((p) => !p.ultima_fecha || p.ultima_fecha < limitePediluvio).length;

  const botones = puedeEditar ? (
    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      <Link href="/hato/sanidad/programar" className={clasesBoton("primario")}>
        <CalendarClock className="size-5" strokeWidth={2} aria-hidden="true" /> Programar
      </Link>
      <Link href="/hato/sanidad/nuevo" className={clasesBoton("secundario")}>
        <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar lo aplicado
      </Link>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <AvisoGuardado activo={guardado} />
      <AyudaModulo ayuda={ayudaSanidad(ajustes)} />
      {botones}

      {programas.length === 0 && refuerzos.length === 0 ? (
        <EstadoVacio
          icono={<Syringe strokeWidth={1.5} />}
          titulo="No hay nada programado"
          descripcion="Programa una vacuna, desparasitación o tratamiento, elige los animales a los que aplica y aquí verás cuándo toca aplicarlo."
        />
      ) : null}

      {programas.length > 0 ? (
        <section className="space-y-2" aria-label="Programadas">
          <h2 className="font-display text-lg font-semibold">Programadas</h2>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {programas.map((p) => {
              const e = estadoFechaPrograma(p.fecha_programada, hoy);
              const nombre = p.producto_nombre?.trim() || ETIQUETA_EVENTO[p.tipo];
              const pendientes = p.animales - p.aplicados;
              return (
                <li key={p.id} className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                  <div className="flex items-start gap-3">
                    <IconoEvento tipo={p.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold [overflow-wrap:anywhere]">{nombre}</p>
                      <p className="text-sm text-humo">
                        {ETIQUETA_EVENTO[p.tipo]} · {formatoFecha(p.fecha_programada, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Insignia tono={e.tono}>{e.texto}</Insignia>
                        <span className="text-xs text-humo">
                          {p.aplicados} de {p.animales} {p.animales === 1 ? "animal" : "animales"} · faltan {pendientes}
                        </span>
                      </p>
                      {p.observaciones ? <p className="mt-1 text-sm text-humo [overflow-wrap:anywhere]">{p.observaciones}</p> : null}
                    </div>
                  </div>
                  {puedeEditar ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-arena pt-2">
                      <Link href={`/hato/sanidad/nuevo?programa=${p.id}`} className="inline-flex min-h-11 items-center rounded-full bg-musgo px-5 text-sm font-semibold text-sobre-musgo">
                        Aplicar
                      </Link>
                      <span className="flex items-center">
                        <Link href={`/hato/sanidad/programar?id=${p.id}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                          Editar
                        </Link>
                        <CancelarPrograma id={p.id} nombre={nombre} />
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {refuerzos.length > 0 ? (
        <section className="space-y-2" aria-label="Próximas dosis">
          <h2 className="font-display text-lg font-semibold">Próximas dosis</h2>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {refuerzos.map((g) => {
              const e = estadoDosis(g.proxima_fecha, hoy);
              return (
                <li key={g.evento_id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                  <IconoEvento tipo={g.tipo} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold [overflow-wrap:anywhere]">{nombreEvento(g)}</p>
                    <p className="text-sm text-humo">
                      {g.tipo ? ETIQUETA_EVENTO[g.tipo] : ""} · {g.animales} {g.animales === 1 ? "animal" : "animales"}
                    </p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      <Insignia tono={e.tono}>{e.texto}</Insignia>
                      <Insignia>{formatoFecha(g.proxima_fecha, { day: "numeric", month: "short" })}</Insignia>
                    </p>
                  </div>
                  {puedeEditar ? (
                    <Link href={`/hato/sanidad/nuevo?refuerzo=${g.evento_id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                      Aplicar
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {famachaDesparasitar > 0 || famachaVigilar > 0 ? (
        <section className="rounded-2xl bg-lana p-3.5" aria-label="FAMACHA">
          <p className="mb-1 font-bold">FAMACHA</p>
          <AvisoFamacha desparasitar={famachaDesparasitar} vigilar={famachaVigilar} puedeProgramar={puedeEditar} />
        </section>
      ) : null}

      {sinPodologia > 0 ? (
        <section className="rounded-2xl bg-lana p-3.5" aria-label="Podología">
          <div className="flex items-start gap-3">
            <Footprints className="mt-0.5 size-6 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">Podología pendiente</p>
              <p className="mt-0.5 text-[0.9375rem] text-humo">
                {sinPodologia} {sinPodologia === 1 ? "animal lleva" : "animales llevan"} más de {textoPlazo(ajustes.podologia_inspeccion_dias)} sin recorte de pezuñas registrado. La inspección periódica previene cojeras y gabatillo, sobre todo antes del empadre y de los partos.
              </p>
              {puedeEditar ? (
                <Link href="/hato/sanidad/programar?tipo=podologia&grupo=podologia" className="mt-1 inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
                  Programar podología para ellos
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {sinPediluvio > 0 ? (
        <section className="rounded-2xl bg-lana p-3.5" aria-label="Pediluvio">
          <div className="flex items-start gap-3">
            <Footprints className="mt-0.5 size-6 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">Pediluvio pendiente</p>
              <p className="mt-0.5 text-[0.9375rem] text-humo">
                {sinPediluvio} {sinPediluvio === 1 ? "animal lleva" : "animales llevan"} más de {textoPlazo(diasPediluvio)} sin baño de patas registrado. Se repite cada {textoPlazo(ajustes.pediluvio_dias)}, y cada {textoPlazo(ajustes.pediluvio_dias_lluvia)} en épocas de lluvias.
              </p>
              {puedeEditar ? (
                <Link href="/hato/sanidad/programar?tipo=pediluvio&grupo=pediluvio" className="mt-1 inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
                  Programar pediluvio para ellos
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
