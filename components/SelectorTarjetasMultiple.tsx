"use client";

import { TarjetaOpcion } from "@/components/TarjetaOpcion";
import type { OpcionTarjeta } from "@/components/SelectorTarjetas";

/**
 * Elegir varias opciones entre pocas, como tarjetas que se encienden y se apagan (por ejemplo, las especialidades de un veterinario). Manda un solo
 * valor con las elegidas separadas por coma. Para elegir una sola, `SelectorTarjetas`.
 */
export function SelectorTarjetasMultiple<T extends string>({
  id,
  nombre,
  valor,
  opciones,
  onCambio,
  titulo,
}: {
  id?: string;
  nombre?: string;
  valor: T[];
  opciones: OpcionTarjeta<T>[];
  onCambio: (v: T[]) => void;
  titulo: string;
}) {
  const alternar = (v: T) => onCambio(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);
  return (
    <>
      {nombre ? <input type="hidden" name={nombre} value={valor.join(",")} /> : null}
      <div id={id} role="group" aria-label={titulo} className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {opciones.map((o) => (
          <TarjetaOpcion key={o.valor} tamano="normal" escena={o.escena} titulo={o.etiqueta} detalle={o.detalle} activo={valor.includes(o.valor)} onClick={() => alternar(o.valor)} />
        ))}
      </div>
    </>
  );
}
