import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { CONSEJO_BAJA, ETIQUETA_NIVEL_BAJA, mensajeBaja, type TendenciaBaja } from "@/lib/produccion";

export type AlertaProduccion = TendenciaBaja & { etiqueta: string };

/** Hembras cuya producción diaria viene bajando de forma inesperada, para revisar qué pasa con cada una. */
export function AlertasProduccion({ alertas, limite }: { alertas: AlertaProduccion[]; limite?: number }) {
  if (alertas.length === 0) return null;
  const ordenadas = [...alertas].sort((a, b) => a.variacion - b.variacion);
  const visibles = limite ? ordenadas.slice(0, limite) : ordenadas;
  return (
    <Tarjeta titulo={alertas.length === 1 ? "Una hembra con la producción bajando" : `${alertas.length} hembras con la producción bajando`}>
      <p className="mb-2 flex items-start gap-2 text-[0.9375rem] text-humo">
        <TrendingDown className="mt-0.5 size-4 shrink-0 text-ambar" strokeWidth={2} aria-hidden="true" />
        <span>{CONSEJO_BAJA}</span>
      </p>
      <ul className="divide-y divide-arena">
        {visibles.map((a) => (
          <li key={a.animal_id}>
            <Link href={`/hato/${a.animal_id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-semibold [overflow-wrap:anywhere]">{a.etiqueta}</span>
                <span className="block text-sm text-humo">{mensajeBaja(a)}</span>
              </span>
              <Insignia tono={a.nivel === "critico" ? "alerta" : "aviso"}>{ETIQUETA_NIVEL_BAJA[a.nivel]}</Insignia>
            </Link>
          </li>
        ))}
      </ul>
      {limite && alertas.length > limite ? (
        <Link href="/leche" className="mt-2 block min-h-11 py-2.5 text-[0.9375rem] font-semibold text-musgo">
          Ver las {alertas.length} en Leche
        </Link>
      ) : null}
    </Tarjeta>
  );
}
