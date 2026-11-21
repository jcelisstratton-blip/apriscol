"use client";

import { RecuadroTarjetas } from "@/components/TarjetaOpcion";
import { useArrastrarParaDesplazar } from "@/lib/arrastrar-para-desplazar";

/**
 * Una fila de tarjetas que se desplaza de lado en **todos** los tamaños (a diferencia de `FilaTarjetas`, que en el computador se acomoda en varias
 * filas): para mostrar una colección completa en una sola línea, como las opciones de «Registrar sin señal» en la pantalla de entrada. En el celular se
 * desliza con el dedo y en el computador se arrastra con el mouse (`useArrastrarParaDesplazar`); se difumina en el borde con más contenido. Mientras se arrastra se suspende el ajuste de las tarjetas (`snap`), como pide el repo.
 */
export function FilaTarjetasDeLado({ children, etiqueta, className = "" }: { children: React.ReactNode; etiqueta: string; className?: string }) {
  const { ref, arrastrando, desborda, props } = useArrastrarParaDesplazar<HTMLDivElement>();
  return (
    <RecuadroTarjetas className={className}>
      <div
        ref={ref}
        {...props}
        role="group"
        aria-label={etiqueta}
        className={`no-scrollbar -mx-2.5 flex scroll-px-2.5 gap-2.5 overflow-x-auto px-2.5 pb-1 pt-1 [mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-24px),transparent)] lg:-mx-4 lg:scroll-px-4 lg:gap-3 lg:px-4 ${arrastrando ? "cursor-grabbing select-none" : `snap-x ${desborda ? "cursor-grab" : ""}`}`}
      >
        {children}
      </div>
    </RecuadroTarjetas>
  );
}
