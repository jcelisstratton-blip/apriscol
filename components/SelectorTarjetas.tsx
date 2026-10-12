"use client";

import { TarjetaOpcion } from "@/components/TarjetaOpcion";
import { escena, type EscenaDef } from "@/lib/escenas";
import { CircleSlash } from "lucide-react";

export type OpcionTarjeta<T extends string | number> = { valor: T; etiqueta: string; detalle?: string; escena: EscenaDef };

const SIN_ESPECIFICAR = escena(CircleSlash, "grafito");

/**
 * Elegir una opción entre pocas (hasta unas 8) viendo todas a la vez, como tarjetas. Reemplaza a `Selector` cuando cada opción es un
 * concepto que se puede ilustrar (tipo de tratamiento, motivo, piso…); para listas largas (razas, municipios) sigue el `Selector`.
 * Mismas props que `Selector` (valor, onCambio, nombre, permitirVacio) y cada opción lleva su `escena`.
 */
export function SelectorTarjetas<T extends string | number>({
  id,
  nombre,
  valor,
  opciones,
  onCambio,
  titulo,
  permitirVacio,
  etiquetaVacio = "Sin especificar",
  deshabilitado = false,
}: {
  id?: string;
  nombre?: string;
  valor: T | "";
  opciones: OpcionTarjeta<T>[];
  onCambio: (v: T | "") => void;
  titulo: string;
  permitirVacio?: boolean;
  /** Lo que dice la tarjeta de «ninguna» cuando `permitirVacio` (por ejemplo «No se midió»). */
  etiquetaVacio?: string;
  deshabilitado?: boolean;
}) {
  return (
    <>
      {nombre ? <input type="hidden" name={nombre} value={valor} /> : null}
      <div id={id} role="radiogroup" aria-label={titulo} className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {permitirVacio ? <TarjetaOpcion tamano="normal" rol="radio" escena={SIN_ESPECIFICAR} titulo={etiquetaVacio} activo={valor === ""} onClick={() => onCambio("")} deshabilitada={deshabilitado} /> : null}
        {opciones.map((o) => (
          <TarjetaOpcion key={o.valor} tamano="normal" rol="radio" escena={o.escena} titulo={o.etiqueta} detalle={o.detalle} activo={o.valor === valor} onClick={() => onCambio(o.valor)} deshabilitada={deshabilitado} />
        ))}
      </div>
    </>
  );
}
