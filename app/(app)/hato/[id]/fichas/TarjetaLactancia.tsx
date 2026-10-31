import { BotonSecar } from "@/components/BotonSecar";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha, litros, sumarDias } from "@/lib/fechas";
import { GraficoProduccion } from "@/components/GraficoProduccion";
import { CONSEJO_BAJA, esBaja, mensajeBaja } from "@/lib/produccion";
import { TurnosAnimal } from "@/components/TurnosAnimal";
import type { LactanciaResumen } from "@/lib/tipos";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Lactancia del animal y vigilancia de su producción (solo hembras). */
export async function TarjetaLactancia({ c, lac }: { c: CtxFicha; lac: LactanciaResumen | null }) {
  const { id, animal, finca, rol, supabase, hoy } = c;
  const verLeche = puedeVer(rol, "leche", finca.plan) && animal.sexo === "hembra";
  const lacAbierta = lac && !lac.fecha_secado;
  const lacActual = lac;
  const vigilarProduccion = verLeche && Boolean(lacActual) && !lacActual?.fecha_secado;
  const [tendenciasHato, ordenosRecientes] = vigilarProduccion
    ? await Promise.all([
        supabase.rpc("produccion_tendencia", { p_finca: finca.id }),
        supabase.from("ordenos").select("fecha, litros").eq("animal_id", id).eq("finca_id", finca.id).gte("fecha", sumarDias(hoy, -14)).lte("fecha", sumarDias(hoy, -1)),
      ])
    : [{ data: null }, { data: null }];
  const tendenciaAnimal = tendenciasHato.data?.find((t) => t.animal_id === id);
  const litrosPorDia = new Map<string, number>();
  for (const o of ordenosRecientes.data ?? []) litrosPorDia.set(o.fecha, (litrosPorDia.get(o.fecha) ?? 0) + Number(o.litros));
  const diasGrafico = Array.from({ length: 14 }, (_, i) => {
    const fecha = sumarDias(hoy, i - 14);
    return { fecha, litros: litrosPorDia.get(fecha) ?? null };
  });
  if (!(verLeche && (lac || animal.estado === "activo"))) return null;

  return (
    <Tarjeta titulo="Lactancia" id="lactancia">
      {lac ? (
        <>
        <dl className="divide-y divide-arena">
          <Dato etiqueta="Lactancia">N.º {lac.numero}{lac.fecha_secado ? " · seca" : " · abierta"}</Dato>
          <Dato etiqueta="Desde el parto">{formatoFecha(lac.fecha_parto)}</Dato>
          <Dato etiqueta="Días en leche">{lac.dias_lactancia}</Dato>
          <Dato etiqueta="Total">{litros(lac.litros_total)} L</Dato>
          <Dato etiqueta="Promedio por día">{lac.promedio_diario == null ? "—" : `${litros(lac.promedio_diario)} L`}</Dato>
          <Dato etiqueta="Pico en un día">{lac.pico_diario == null ? "—" : `${litros(lac.pico_diario)} L`}</Dato>
        </dl>
        {lacAbierta && animal.estado === "activo" ? (
          <div className="mt-4 space-y-1.5">
            <p className="text-sm font-semibold">Turnos de ordeño</p>
            <TurnosAnimal animalId={id} programados={animal.turnos_ordeno} puedeEditar={puedeEscribir(rol, "hato", finca.plan)} />
          </div>
        ) : null}
        {lacAbierta && animal.estado === "activo" && puedeEscribir(rol, "leche", finca.plan) ? (
          <div className="mt-3">
            <BotonSecar animalId={id} etiqueta={animal.nombre ?? animal.numero_arete} />
          </div>
        ) : null}
        <Link href={`/leche?animal=${id}`} className="mt-3 inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
          Ver toda su producción
        </Link>
        {vigilarProduccion ? (
          <div className="mt-4 space-y-3">
            {tendenciaAnimal && esBaja(tendenciaAnimal) ? (
              <Aviso tipo="atencion">
                <strong>Su producción viene bajando.</strong> {mensajeBaja(tendenciaAnimal)} {CONSEJO_BAJA}
              </Aviso>
            ) : tendenciaAnimal?.nivel === "normal" ? (
              <Aviso tipo="info">
                Su producción se mantiene: {litros(tendenciaAnimal.litros_base)} L al día antes y {litros(tendenciaAnimal.litros_recientes)} L en los últimos 3 días.
              </Aviso>
            ) : (
              <Aviso tipo="info">Con unos 6 días de ordeño registrados, aquí te avisamos si su producción empieza a bajar.</Aviso>
            )}
            {diasGrafico.some((d) => d.litros !== null) ? (
              <GraficoProduccion dias={diasGrafico} promedioBase={tendenciaAnimal?.litros_base ?? null} />
            ) : null}
          </div>
        ) : null}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-humo">Todavía no está en ordeño. Si ya da leche, ponla en el ordeño para registrar sus litros.</p>
          {puedeEscribir(rol, "leche", finca.plan) && animal.estado === "activo" ? (
            <Link href={`/hato?vista=ordeno&agregar=${id}`} className={clasesBoton("secundario")}>
              Poner en ordeño
            </Link>
          ) : null}
        </div>
      )}
    </Tarjeta>
  );
}
