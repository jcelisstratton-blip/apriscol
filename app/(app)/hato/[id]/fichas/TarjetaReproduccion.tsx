import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { diasHasta, formatoFecha, hoyBogota } from "@/lib/fechas";
import { enObservacion, ETIQUETA_ESTADO, ETIQUETA_FETOS, ETIQUETA_INDICADOR, ETIQUETA_METODO, ETIQUETA_OBSERVACION, ETIQUETA_VIABILIDAD, ventanaRepetirDx, ETIQUETA_PARTO, ETIQUETA_RESULTADO, ETIQUETA_SERVICIO, plazoParto, textoPartos, TONO_ESTADO } from "@/lib/reproduccion";
import { PartosPrevios } from "@/components/PartosPrevios";
import type { DiagnosticoGestacion } from "@/lib/tipos";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Lo propio del método en una línea: días, fetos y latido de la ecografía; indicador y condición corporal de la palpación; o la prueba y su resultado. */
function detalleDiagnostico(x: DiagnosticoGestacion): string | undefined {
  const partes = [
    x.dias_gestacion != null && `${x.dias_gestacion} días`,
    x.num_fetos != null && ETIQUETA_FETOS[x.num_fetos]?.toLowerCase(),
    x.viabilidad_fetal && ETIQUETA_VIABILIDAD[x.viabilidad_fetal].toLowerCase(),
    x.indicador_palpacion && ETIQUETA_INDICADOR[x.indicador_palpacion].toLowerCase(),
    x.condicion_corporal != null && `condición corporal ${String(x.condicion_corporal).replace(".", ",")}`,
    x.prueba_nombre && `${x.prueba_nombre}${x.prueba_resultado ? `: ${x.prueba_resultado}` : ""}`,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : undefined;
}

/** Estado reproductivo de la hembra y su historial de servicios, diagnósticos y partos. */
export async function TarjetaReproduccion({ c, sinCrear }: { c: CtxFicha; sinCrear: string }) {
  const { id, animal, finca, rol, ajustes, supabase } = c;
  const verRepro = puedeVer(rol, "reproduccion", finca.plan) && animal.sexo === "hembra";
  const [reproDB, serviciosDB, diagnosticosDB, partosDB] = verRepro
    ? await Promise.all([
        supabase.from("v_repro_hembras").select("*").eq("animal_id", id).maybeSingle(),
        supabase.from("servicios").select("*").eq("hembra_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
        supabase.from("diagnosticos_gestacion").select("*").eq("hembra_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
        supabase.from("partos").select("*").eq("madre_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(10),
      ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }];
  const repro = reproDB.data;
  const todoRepro = [
    ...(serviciosDB.data ?? []).map((x) => ({ clave: `s-${x.id}`, fecha: x.fecha, tipo: "servicio" as const, href: `/reproduccion/servicios/${x.id}`, texto: `Servicio · ${ETIQUETA_SERVICIO[x.tipo]}` })),
    ...(diagnosticosDB.data ?? []).map((x) => ({ clave: `d-${x.id}`, fecha: x.fecha, tipo: "diagnostico" as const, href: `/reproduccion/diagnosticos/${x.id}`, texto: `Diagnóstico · ${ETIQUETA_RESULTADO[x.resultado]} (${ETIQUETA_METODO[x.metodo].toLowerCase()})`, detalle: detalleDiagnostico(x) })),
    ...(partosDB.data ?? []).map((x) => ({ clave: `p-${x.id}`, fecha: x.fecha, tipo: "parto" as const, href: `/reproduccion/partos/${x.id}`, texto: `${ETIQUETA_PARTO[x.tipo]}${x.tipo === "aborto" ? "" : ` · ${x.numero_crias} ${x.numero_crias === 1 ? "cría" : "crías"}`}` })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const historialRepro = todoRepro.slice(0, 8);
  const mostrarRepro = verRepro && (animal.estado === "activo" || historialRepro.length > 0);
  if (!(mostrarRepro)) return null;

  return (
    <Tarjeta titulo="Reproducción" id="reproduccion">
      {sinCrear ? (
        <Aviso tipo="atencion" className="mb-3">
          El parto quedó registrado, pero no se pudieron crear como animales las crías con arete {sinCrear.split(",").join(", ")}. Créalas desde «Animal nuevo» (ponle a esta hembra como madre).
        </Aviso>
      ) : null}
      {repro ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={TONO_ESTADO[repro.estado]}>{ETIQUETA_ESTADO[repro.estado]}</Insignia>
            {enObservacion(repro) ? <Insignia tono="aviso">{ETIQUETA_OBSERVACION}</Insignia> : null}
            {repro.fecha_prevista_parto ? <Insignia tono={plazoParto(repro.fecha_prevista_parto, hoyBogota()).tono}>{plazoParto(repro.fecha_prevista_parto, hoyBogota()).texto}</Insignia> : null}
            {repro.en_lactancia ? <Insignia tono="musgo">En lactancia</Insignia> : null}
            {repro.empadronamiento_id ? <Insignia tono="aviso">En empadronamiento</Insignia> : null}
          </div>
          <dl className="divide-y divide-arena">
            {repro.empadronamiento_id ? (
              <Dato etiqueta="Temporada de monta">
                <Link href={`/reproduccion/empadronamiento/${repro.empadronamiento_id}`} className="text-musgo underline-offset-4 hover:underline">{repro.empadronamiento_nombre}</Link>
              </Dato>
            ) : null}
            {repro.fecha_prevista_parto ? <Dato etiqueta="Parto previsto">{formatoFecha(repro.fecha_prevista_parto)}</Dato> : null}
            {repro.ultimo_servicio ? <Dato etiqueta="Último servicio">{formatoFecha(repro.ultimo_servicio)}</Dato> : null}
            {repro.ultimo_parto ? <Dato etiqueta="Último parto">{formatoFecha(repro.ultimo_parto)}</Dato> : null}
            <Dato etiqueta="Partos">{textoPartos(repro.partos_totales)}</Dato>
          </dl>
          {enObservacion(repro) && repro.fecha_diagnostico ? (
            <Aviso tipo={hoyBogota() >= ventanaRepetirDx(repro.fecha_diagnostico).desde ? "atencion" : "info"}>
              El último diagnóstico fue dudoso. Conviene repetirlo entre el {formatoFecha(ventanaRepetirDx(repro.fecha_diagnostico).desde)} y el {formatoFecha(ventanaRepetirDx(repro.fecha_diagnostico).hasta)}.
            </Aviso>
          ) : null}
          {repro.estado === "servida" && !enObservacion(repro) && repro.ultimo_servicio && diasHasta(hoyBogota(), repro.ultimo_servicio) >= ajustes.general.dx_prenez_dia_desde ? (
            <Aviso tipo="atencion">Ya pasaron {diasHasta(hoyBogota(), repro.ultimo_servicio)} días del servicio: conviene confirmar con un diagnóstico si quedó gestante.</Aviso>
          ) : null}
          {animal.estado === "activo" ? <PartosPrevios animalId={id} previos={animal.partos_previos} registrados={repro.partos_registrados} puedeEditar={puedeEscribir(rol, "hato", finca.plan)} /> : null}
        </div>
      ) : null}
      {historialRepro.length > 0 ? (
        <ul className="mt-3 divide-y divide-arena">
          {historialRepro.map((e) => (
            <li key={e.clave} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-[0.9375rem] [overflow-wrap:anywhere]">
                <span className="font-semibold">{e.texto}</span>
                {"detalle" in e && e.detalle ? <span className="block text-sm text-humo">{e.detalle}</span> : null}
                <span className="block text-sm text-humo">{formatoFecha(e.fecha, { day: "numeric", month: "short", year: "numeric" })}</span>
              </span>
              {puedeEscribir(rol, "reproduccion", finca.plan) ? (
                <Link href={e.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  Editar
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-humo">Todavía no tiene servicios, diagnósticos ni partos registrados.</p>
      )}
      {todoRepro.length > historialRepro.length ? (
        <p className="mt-1 text-sm text-humo">
          Se muestran los {historialRepro.length} más recientes. Todos están en{" "}
          <Link href="/reproduccion?vista=servicios" className="font-semibold text-musgo underline-offset-4 hover:underline">
            Reproducción
          </Link>
          .
        </p>
      ) : null}
      {puedeEscribir(rol, "reproduccion", finca.plan) && animal.estado === "activo" ? (
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <Link href={`/hato/${id}/reproduccion/servicio/nuevo`} className={clasesBoton("secundario")}>
            Servicio
          </Link>
          <Link href={`/hato/${id}/reproduccion/diagnostico/nuevo`} className={clasesBoton("secundario")}>
            Diagnóstico
          </Link>
          <Link href={`/hato/${id}/reproduccion/parto/nuevo`} className={clasesBoton("secundario")}>
            Parto
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  );
}
