"use client";

import { BotonPausaMovimiento } from "@/components/BotonPausaMovimiento";
import { RecuadroTarjetas } from "@/components/TarjetaOpcion";
import { useArrastrarParaDesplazar } from "@/lib/arrastrar-para-desplazar";
import { useDesplazamientoContinuo } from "@/lib/desplazamiento-continuo";

/**
 * Una fila de tarjetas que se desplaza de lado en **todos** los tamaños (a diferencia de `FilaTarjetas`, que en el computador se acomoda en varias
 * filas): para mostrar una colección completa en una sola línea, como las opciones de «Registrar sin señal» en la pantalla de entrada. En el celular se
 * desliza con el dedo y en el computador se arrastra con el mouse (`useArrastrarParaDesplazar`); se difumina en el borde con más contenido. Mientras se arrastra se suspende el ajuste de las tarjetas (`snap`), como pide el repo.
 *
 * `encabezado` va arriba de la fila, a la izquierda del botón de pausa. La fila se desliza sola, despacio y sin parar (`useDesplazamientoContinuo`):
 * lleva las tarjetas dos veces y la copia queda oculta para lectores de pantalla y teclado. Con «Reducir movimiento» queda quieta y sin copia.
 */
export function FilaTarjetasDeLado({ children, etiqueta, encabezado, className = "" }: { children: React.ReactNode; etiqueta: string; encabezado?: React.ReactNode; className?: string }) {
  const { ref, arrastrando, desborda, props } = useArrastrarParaDesplazar<HTMLDivElement>();
  const { continuo, pausado, alternarPausa } = useDesplazamientoContinuo(ref);
  const ajuste = arrastrando ? "cursor-grabbing select-none" : continuo && !pausado ? "cursor-grab" : `snap-x ${desborda ? "cursor-grab" : ""}`;
  const tarjetas = "flex shrink-0 gap-2.5 lg:gap-3 [&>*]:transition [&>*]:duration-300 [&>*]:ease-[var(--ease-salida)] [&>*:hover]:-translate-y-0.5 [&>*:hover]:shadow-[0_12px_22px_-16px_rgba(60,45,20,0.45)]";

  return (
    <div className="space-y-3">
      {encabezado || continuo ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex-1">{encabezado}</div>
          {continuo ? <BotonPausaMovimiento pausado={pausado} onClick={alternarPausa} /> : null}
        </div>
      ) : null}
      <RecuadroTarjetas className={className}>
        <div
          ref={ref}
          {...props}
          role="group"
          aria-label={etiqueta}
          className={`no-scrollbar relative -mx-2.5 flex scroll-px-2.5 gap-2.5 overflow-x-auto px-2.5 pb-1 pt-1 [mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-24px),transparent)] lg:-mx-4 lg:scroll-px-4 lg:gap-3 lg:px-4 ${ajuste}`}
        >
          <div className={tarjetas}>{children}</div>
          {continuo ? (
            <div data-copia="" aria-hidden="true" inert className={tarjetas}>
              {children}
            </div>
          ) : null}
        </div>
      </RecuadroTarjetas>
    </div>
  );
}
