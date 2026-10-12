import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { ListaCalidad } from "@/components/ListaCalidad";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha, hoyBogota, sumarDias } from "@/lib/fechas";
import { estadoCrioscopia, estadoRcs, estadoResiduos, formatoCrioscopia, formatoMiles, RCS_ALTO } from "@/lib/leche-calidad";
import { direccionSoporte } from "@/lib/soportes";
import type { AnalisisLeche } from "@/lib/tipos";

const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

/** Calidad de la leche de toda la finca: el último análisis del tanque, los animales con células somáticas altas y el historial. */
export async function Calidad({
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
  const desde = sumarDias(hoyBogota(), -180);
  const [tanque, altosDB] = await Promise.all([
    supabase.from("analisis_leche").select("*").eq("finca_id", fincaId).is("animal_id", null).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // El último recuento de cada animal (de los últimos 6 meses) que pasa del límite.
    supabase.from("v_rcs_leche_ultimo").select("*").eq("finca_id", fincaId).gt("rcs_miles_ml", RCS_ALTO).gte("fecha", desde).order("rcs_miles_ml", { ascending: false }).limit(200),
  ]);

  const ultimo = tanque.data as AnalisisLeche | null;
  const altos = (altosDB.data ?? []) as AnalisisLeche[];
  const nombres = new Map((await animalesPorIds(supabase, fincaId, altos.slice(0, 8).map((a) => a.animal_id!))).map((a) => [a.id, etiquetaAnimal(a)]));
  const rcsTanque = ultimo?.rcs_miles_ml != null ? estadoRcs(ultimo.rcs_miles_ml) : null;

  return (
    <div className="space-y-4">
      <PorQueAnalizar linea="leche" />
      {ultimo ? (
        <Tarjeta titulo="Último análisis del tanque">
          <p className="text-sm text-humo [overflow-wrap:anywhere]">
            {formatoFecha(ultimo.fecha)}
            {ultimo.muestra ? ` · ${ultimo.muestra}` : ""}
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            {[
              ["Grasa", ultimo.grasa_pct != null ? pct(ultimo.grasa_pct) : "—"],
              ["Proteína", ultimo.proteina_pct != null ? pct(ultimo.proteina_pct) : "—"],
              ["Células", ultimo.rcs_miles_ml != null ? ultimo.rcs_miles_ml.toLocaleString("es-CO") : "—"],
            ].map(([e, v]) => (
              <div key={e} className="min-w-0 rounded-2xl bg-lana px-1.5 py-3">
                <dd className="font-display text-xl font-semibold tabular-nums">{v}</dd>
                <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {rcsTanque ? <Insignia tono={rcsTanque.tono}>{`Células somáticas: ${rcsTanque.texto.toLowerCase()} (${formatoMiles(ultimo.rcs_miles_ml!)})`}</Insignia> : null}
            {ultimo.crioscopia_c != null ? <Insignia tono={estadoCrioscopia(ultimo.crioscopia_c).tono}>{`Crioscopia ${formatoCrioscopia(ultimo.crioscopia_c)}: ${estadoCrioscopia(ultimo.crioscopia_c).texto.toLowerCase()}`}</Insignia> : null}
            {ultimo.residuos_antibioticos ? <Insignia tono={estadoResiduos(ultimo.residuos_antibioticos).tono}>{`Antibióticos: ${estadoResiduos(ultimo.residuos_antibioticos).texto.toLowerCase()}`}</Insignia> : null}
            {ultimo.soporte_path ? (
              <a href={direccionSoporte(ultimo.soporte_path)} target="_blank" rel="noopener noreferrer" className="font-semibold text-musgo underline-offset-4 hover:underline">
                Ver documento
              </a>
            ) : (
              <Insignia tono="aviso">Sin documento</Insignia>
            )}
          </p>
        </Tarjeta>
      ) : null}

      {altos.length > 0 ? (
        <Tarjeta titulo="Animales con células somáticas altas">
          <Aviso tipo="atencion">
            {altos.length === 1 ? "1 animal tiene" : `${altos.length} animales tienen`} más de {RCS_ALTO.toLocaleString("es-CO")} mil células por ml en su último análisis. Puede ser mastitis: conviene hacerles el CMT.
          </Aviso>
          <ul className="mt-2 divide-y divide-arena">
            {altos.slice(0, 8).map((a) => (
              <li key={a.id}>
                <Link href={`/hato/${a.animal_id}#calidad`} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block font-semibold">{nombres.get(a.animal_id!) ?? "Animal"}</span>
                    <span className="block text-sm text-humo">{formatoFecha(a.fecha)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-rojo">
                    {formatoMiles(a.rcs_miles_ml!)} <ChevronRight className="size-4 text-humo" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      <ListaCalidad fincaId={fincaId} puedeEditar={puedeEditar} />
    </div>
  );
}
