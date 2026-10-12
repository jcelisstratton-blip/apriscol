import { NivelEndogamia } from "@/components/NivelEndogamia";
import { porcentaje } from "@/lib/endogamia";

/**
 * Las cifras de la pantalla de endogamia: cuántos animales se pudieron medir y cómo se reparten frente al umbral de la finca
 * (sobre el umbral, bajo el umbral con algo de endogamia, y sin endogamia).
 */
export function ResumenEndogamia({
  medidos,
  sobre,
  bajo,
  mayor,
  activos,
}: {
  medidos: number;
  sobre: number;
  bajo: number;
  mayor: number | undefined;
  activos: number;
}) {
  const sin = medidos - sobre - bajo;
  const cifras: [string, string][] = [
    ["Animales medidos", String(medidos)],
    ["Sobre el umbral", String(sobre)],
    ["Bajo el umbral, con algo de endogamia", String(bajo)],
    ["La más alta", mayor ? porcentaje(mayor) : "0 %"],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
        {cifras.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
            <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{valor}</dd>
            <dt className="mt-0.5 text-xs font-medium text-humo">{etiqueta}</dt>
          </div>
        ))}
      </dl>
      <p className="px-1 text-sm text-humo">
        {medidos} de tus {activos} animales activos tienen padre y madre registrados; en el resto no se puede medir.
        {sin > 0 ? ` De los ${medidos} medidos, ${sin} ${sin === 1 ? "no tiene" : "no tienen"} endogamia.` : ""}
      </p>
    </>
  );
}

/** Cómo leer los porcentajes y los niveles, con los valores reales del umbral de la finca. */
export function LeyendaEndogamia({ umbral }: { umbral: number }) {
  return (
    <details className="group rounded-2xl bg-papel ring-1 ring-arena">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-[0.9375rem] font-semibold text-musgo">
        <span className="min-w-0">¿Cómo leer estos porcentajes?</span>
        <span className="shrink-0 text-sm font-medium text-humo group-open:hidden">Ver</span>
        <span className="hidden shrink-0 text-sm font-medium text-humo group-open:inline">Ocultar</span>
      </summary>
      <div className="space-y-3 border-t border-arena p-3.5 text-[0.9375rem]">
        <p>
          La endogamia dice qué tan emparentados están el padre y la madre de un animal. Va de 0 % (sin parentesco) hasta 25 % (padre y madre
          hermanos). Mientras más alta, más riesgo de defectos y de pérdida de vigor.
        </p>
        <p>
          Tu <strong>umbral</strong> es <strong>{porcentaje(umbral)}</strong>: desde ahí marcamos al animal como de endogamia alta. Los niveles de cada
          animal se leen contra ese valor:
        </p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2.5">
            <span className="w-20 shrink-0"><NivelEndogamia f={umbral * 2} umbral={umbral} /></span>
            <span>{porcentaje(umbral * 2)} o más (el doble del umbral). Conviene evitar esas cruzas.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-20 shrink-0"><NivelEndogamia f={umbral} umbral={umbral} /></span>
            <span>Desde {porcentaje(umbral)} hasta menos de {porcentaje(umbral * 2)}. Sobre el umbral de tu finca.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-20 shrink-0"><NivelEndogamia f={umbral * 0.75} umbral={umbral} /></span>
            <span>Desde {porcentaje(umbral / 2)} hasta menos de {porcentaje(umbral)}. Todavía es aceptable, pero ya se acerca al umbral.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-20 shrink-0"><NivelEndogamia f={umbral / 4} umbral={umbral} /></span>
            <span>Menos de {porcentaje(umbral / 2)}. Aceptable.</span>
          </li>
        </ul>
      </div>
    </details>
  );
}
