import { NivelEndogamia } from "@/components/NivelEndogamia";
import { porcentaje, type Reparto } from "@/lib/endogamia";

/**
 * Las cifras de la pantalla de endogamia: cuántos animales se pudieron medir y cómo se reparten frente al umbral de la finca.
 * Los tres grupos (sobre el umbral, a vigilar y aceptables) suman siempre los animales medidos.
 */
export function ResumenEndogamia({ medidos, reparto, mayor, activos }: { medidos: number; reparto: Reparto; mayor: number | undefined; activos: number }) {
  const cifras: [string, string][] = [
    ["Animales medidos", String(medidos)],
    ["Sobre el umbral", String(reparto.sobre)],
    ["A vigilar", String(reparto.vigilar)],
    ["Aceptables", String(reparto.aceptables)],
    ["La más alta", mayor ? porcentaje(mayor) : "0 %"],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-5">
        {cifras.map(([etiqueta, valor], i) => (
          <div key={etiqueta} className={`min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena ${i === 0 ? "col-span-2 min-[560px]:col-span-1" : ""}`}>
            <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{valor}</dd>
            <dt className="mt-0.5 text-xs font-medium text-humo">{etiqueta}</dt>
          </div>
        ))}
      </dl>
      <p className="px-1 text-sm text-humo">
        {medidos} de tus {activos} animales activos tienen padre y madre registrados; en el resto no se puede medir. Los {medidos} medidos se reparten en
        sobre el umbral, a vigilar y aceptables
        {reparto.sin > 0 ? ` (los aceptables incluyen a ${reparto.sin} que no ${reparto.sin === 1 ? "tiene" : "tienen"} endogamia)` : ""}.
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
          Tu <strong>umbral</strong> es <strong>{porcentaje(umbral)}</strong>: desde ahí marcamos al animal como de endogamia alta. Cada animal cae en un
          nivel, y quien llega justo al valor de un nivel ya entra en él (con {porcentaje(umbral / 2)} ya es «A vigilar»):
        </p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2.5">
            <span className="w-24 shrink-0"><NivelEndogamia f={umbral * 2} umbral={umbral} /></span>
            <span>{porcentaje(umbral * 2)} o más (el doble del umbral). Conviene evitar esas cruzas. Cuenta como sobre el umbral.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-24 shrink-0"><NivelEndogamia f={umbral} umbral={umbral} /></span>
            <span>Desde {porcentaje(umbral)} hasta menos de {porcentaje(umbral * 2)}. Cuenta como sobre el umbral.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-24 shrink-0"><NivelEndogamia f={umbral * 0.75} umbral={umbral} /></span>
            <span>Desde {porcentaje(umbral / 2)} hasta menos de {porcentaje(umbral)}. Todavía está bajo el umbral, pero ya se acerca: conviene vigilarlo.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-24 shrink-0"><NivelEndogamia f={umbral / 4} umbral={umbral} /></span>
            <span>Menos de {porcentaje(umbral / 2)}, incluidos los que no tienen endogamia (0 %).</span>
          </li>
        </ul>
      </div>
    </details>
  );
}
