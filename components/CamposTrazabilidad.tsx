"use client";

import { Campo, CLASE_INPUT } from "@/components/Campo";
import type { TipoBaja } from "@/lib/tipos";

/**
 * Trazabilidad de una salida comercial (venta o sacrificio): peso en vivo, guía de movilización y a dónde fue. Es lo que pide el
 * comprador o la planta y lo que permite saber después qué pasó con cada animal.
 */
export function CamposTrazabilidad({
  tipo,
  peso,
  onPeso,
  pesoInvalido,
  guia,
  onGuia,
  destino,
  onDestino,
}: {
  tipo: TipoBaja;
  peso: string;
  onPeso: (v: string) => void;
  pesoInvalido: boolean;
  guia: string;
  onGuia: (v: string) => void;
  destino: string;
  onDestino: (v: string) => void;
}) {
  const sacrificio = tipo === "sacrificio";
  return (
    <>
      <Campo etiqueta="Peso en vivo (kg)" ayuda="Opcional. Lo que pesó el animal al salir." error={pesoInvalido ? "Escribe un peso en kilos, por ejemplo 36,5." : undefined}>
        {(id) => <input id={id} value={peso} onChange={(e) => onPeso(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 36,5" className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta="Guía de movilización" ayuda="Opcional. El número de la guía sanitaria con la que salió.">
        {(id) => <input id={id} value={guia} onChange={(e) => onGuia(e.target.value)} maxLength={60} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta={sacrificio ? "Planta o lugar del beneficio" : "Destino"} ayuda="Opcional.">
        {(id) => (
          <input
            id={id}
            value={destino}
            onChange={(e) => onDestino(e.target.value)}
            maxLength={160}
            autoComplete="off"
            enterKeyHint="next"
            placeholder={sacrificio ? "Frigorífico o finca donde se sacrificó" : "Municipio, finca o frigorífico"}
            className={CLASE_INPUT}
          />
        )}
      </Campo>
    </>
  );
}
