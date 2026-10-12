import Link from "next/link";
import { Droplets } from "lucide-react";
import { AlertasProduccion } from "@/components/AlertasProduccion";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FiltrosLeche, direccionLeche } from "@/components/FiltrosLeche";
import { GraficoHistorialLeche } from "@/components/GraficoHistorialLeche";
import { Insignia } from "@/components/Insignia";
import { RankingLeche, type FilaRanking } from "@/components/RankingLeche";
import { Tarjeta } from "@/components/Tarjeta";
import { TablaDiasLeche, type DiaLeche } from "@/components/TablaDiasLeche";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, litros as fmt } from "@/lib/fechas";
import { ETIQUETA_JORNADA, calcularTotales, construirSerie, variacion, type FilaHistorial, type PeriodoResuelto } from "@/lib/leche";
import { CONSEJO_BAJA, mensajeBaja, type TendenciaBaja } from "@/lib/produccion";

function Cifra({ etiqueta, valor, unidad, nota }: { etiqueta: string; valor: string; unidad?: string; nota?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-papel px-3 py-3 ring-1 ring-arena">
      <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
      <dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
        {valor}
        {unidad ? <span className="ml-1 text-base font-medium text-humo">{unidad}</span> : null}
      </dd>
      {nota ? <dd className="mt-0.5 text-xs text-humo [overflow-wrap:anywhere]">{nota}</dd> : null}
    </div>
  );
}

function notaVariacion(v: number | null, texto: string) {
  if (v === null) return null;
  const pct = Math.round(Math.abs(v) * 100);
  if (pct === 0) return `Igual que ${texto}`;
  return `${pct} % ${v > 0 ? "más" : "menos"} que ${texto}`;
}

export type DatosHistorial = {
  fincaId: string;
  puedeEditar: boolean;
  hoy: string;
  periodo: PeriodoResuelto;
  animal: { id: string; numero_arete: string; nombre: string | null } | null;
  lactancia: { numero: number; fecha_secado: string | null; dias_lactancia: number } | null;
  tendenciaAnimal?: TendenciaBaja;
  alertas: (TendenciaBaja & { etiqueta: string })[];
  filas: FilaHistorial[];
  previas: FilaHistorial[] | null;
  ranking: FilaRanking[];
  diasAnimal: DiaLeche[];
};

/** Lo que se ve en Leche (sin tocar la base): cifras, gráfica, turnos y el ranking por animal o el día por día. */
export function VistaHistorial({ fincaId, puedeEditar, hoy, periodo, animal, lactancia: lac, tendenciaAnimal, alertas, filas, previas, ranking, diasAnimal }: DatosHistorial) {
  const totales = calcularTotales(filas);
  const totalesPrevios = previas ? calcularTotales(previas) : null;
  const serie = construirSerie(filas, periodo.desde, periodo.hasta);
  const texto = periodo.id === "todo" ? "todo el historial" : `los ${periodo.dias} días anteriores`;
  const rango = `Del ${formatoFecha(periodo.desde, { day: "numeric", month: "short" })} al ${formatoFecha(periodo.hasta, { day: "numeric", month: "short", year: "numeric" })} · ${periodo.dias} ${periodo.dias === 1 ? "día" : "días"}`;
  const ver = (a?: string) => direccionLeche({ periodo: periodo.id, desde: periodo.desde, hasta: periodo.hasta, animal: a ?? null });
  const jornadas = Object.entries(totales.porJornada).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxJornada = Math.max(0.01, ...jornadas.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <FiltrosLeche fincaId={fincaId} animal={animal} periodo={periodo.id} desde={periodo.desde} hasta={periodo.hasta} hoy={hoy} />

      {animal ? (
        <Tarjeta>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(animal)}</p>
              <p className="mt-0.5 text-sm text-humo">
                {lac ? `Lactancia N.º ${lac.numero} · ${lac.fecha_secado ? "seca" : `${lac.dias_lactancia} días en leche`}` : "Sin lactancia registrada"}
              </p>
            </div>
            <Link href={`/hato/${animal.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              Ver su ficha
            </Link>
          </div>
          {tendenciaAnimal ? (
            <p className="mt-3 rounded-2xl bg-lana p-3 text-[0.9375rem]">
              <Insignia tono="aviso">Su producción viene bajando</Insignia> <span className="mt-1 block">{mensajeBaja(tendenciaAnimal)} {CONSEJO_BAJA}</span>
            </p>
          ) : null}
        </Tarjeta>
      ) : alertas.length > 0 ? (
        <AlertasProduccion alertas={alertas} />
      ) : null}

      <p className="px-1 text-sm text-humo">{rango}</p>

      {filas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={<Droplets strokeWidth={1.5} />}
            titulo={animal ? "Este animal no tiene ordeños en este periodo" : "No hay ordeños en este periodo"}
            descripcion={animal ? "Prueba con un periodo más largo o mira todo el hato." : "Prueba con un periodo más largo, o registra el ordeño de hoy."}
          >
            <div className="space-y-2">
              {animal ? <EnlaceBoton href={ver()} variante="secundario">Ver todo el hato</EnlaceBoton> : null}
              {puedeEditar ? <EnlaceBoton href="/leche?vista=registrar">Registrar ordeño</EnlaceBoton> : null}
            </div>
          </EstadoVacio>
        </Tarjeta>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Cifra etiqueta="Litros al tanque" valor={fmt(totales.tanque)} unidad="L" nota={totalesPrevios ? notaVariacion(variacion(totales.tanque, totalesPrevios.tanque), texto) : null} />
            <Cifra
              etiqueta="Promedio por día"
              valor={fmt(totales.promedioDia)}
              unidad="L"
              nota={totalesPrevios ? notaVariacion(variacion(totales.promedioDia, totalesPrevios.promedioDia), texto) : `${totales.diasConOrdeno} ${totales.diasConOrdeno === 1 ? "día" : "días"} con ordeño`}
            />
            <Cifra
              etiqueta="Mejor día"
              valor={totales.mejorDia ? fmt(totales.mejorDia.litros) : "—"}
              unidad="L"
              nota={totales.mejorDia ? formatoFecha(totales.mejorDia.fecha, { weekday: "short", day: "numeric", month: "short" }) : null}
            />
            {animal ? (
              <Cifra etiqueta="Ordeños" valor={String(totales.ordenos)} nota={totales.ordenos ? `${fmt(totales.tanque / totales.ordenos)} L por ordeño` : null} />
            ) : (
              <Cifra
                etiqueta="Animales ordeñados"
                valor={String(ranking.length)}
                nota={totales.descartados > 0 ? `${fmt(totales.descartados)} L descartados` : `${totales.ordenos} ordeños`}
              />
            )}
          </dl>
          {animal && totales.descartados > 0 ? <p className="px-1 text-sm text-humo">{fmt(totales.descartados)} L de este animal se descartaron (no fueron al tanque).</p> : null}

          <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
            <Tarjeta titulo={animal ? `Producción de ${animal.nombre ?? animal.numero_arete}` : "Producción de todo el hato"}>
              <GraficoHistorialLeche barras={serie.barras} paso={serie.paso} />
            </Tarjeta>

            {jornadas.length > 0 ? (
              <Tarjeta titulo="Por turno">
                <ul className="space-y-3">
                  {jornadas.map(([j, v]) => (
                    <li key={j}>
                      <div className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                        <span className="font-semibold">{ETIQUETA_JORNADA[j] ?? j}</span>
                        <span className="tabular-nums">
                          {fmt(v)} L <span className="text-humo">· {Math.round((v / totales.tanque) * 100)} %</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-arena" aria-hidden="true">
                        <div className="h-full rounded-full bg-musgo" style={{ width: `${(v / maxJornada) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ) : null}
          </div>

          {animal ? (
            <section className="space-y-2.5">
              <h2 className="px-1 text-base font-bold">Día por día</h2>
              <TablaDiasLeche dias={diasAnimal} />
            </section>
          ) : ranking.length > 0 ? (
            <section className="space-y-2.5">
              <div className="px-1">
                <h2 className="text-base font-bold">Por animal</h2>
                <p className="text-sm text-humo">Toca uno para ver cómo ha producido: su gráfica, sus turnos y cada día.</p>
              </div>
              <RankingLeche filas={ranking} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
