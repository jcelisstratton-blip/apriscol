"use client";

import { useEffect, useState } from "react";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { useDinero } from "@/components/ProveedorMoneda";
import { IMPUESTO, ivaIncluido } from "@/lib/impuestos";
import { leerNumero } from "@/lib/numeros";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * El IVA de una compra o de una venta: opcional. La persona escribe el porcentaje (el que dice su factura) y se le muestra cuánto del total es
 * impuesto, suponiendo que el total ya lo incluye. Vacío = no se registra. La tarifa no se propone: cambia por ley y hay productos sin IVA.
 */
export function CampoIva({ total, inicial, onCambio }: { total: number | null; inicial?: number | null; /** Para los formularios que no envían un <form>: recibe el texto escrito. */ onCambio?: (texto: string) => void }) {
  const dinero = useDinero();
  const [texto, setTexto] = useState(coma(inicial));
  // El valor precargado también cuenta: quien controla el formulario a mano lo recibe desde el primer momento.
  useEffect(() => onCambio?.(coma(inicial)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tarifa = leerNumero(texto);
  const invalida = texto.trim() !== "" && (tarifa === null || tarifa < 0 || tarifa > 100);
  const iva = !invalida && total !== null ? ivaIncluido(total, tarifa) : null;
  return (
    <Campo
      etiqueta={`${IMPUESTO.sigla} (opcional)`}
      error={invalida ? "Escribe un porcentaje entre 0 y 100, por ejemplo 19." : undefined}
      ayuda={`${IMPUESTO.nombre}. Escribe el porcentaje de tu factura y calculamos cuánto del total es ${IMPUESTO.sigla} (el total ya lo incluye). Si no aplica o no lo sabes, déjalo en blanco.`}
    >
      {(id) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input id={id} name="iva_tarifa" value={texto} onChange={(e) => { setTexto(e.target.value); onCambio?.(e.target.value); }} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 19" aria-invalid={invalida} className={`${CLASE_INPUT} max-w-32`} />
            <span className="text-base font-semibold text-humo" aria-hidden="true">%</span>
          </div>
          {iva !== null && total !== null ? (
            <p className="rounded-2xl bg-lana px-4 py-2.5 text-[0.9375rem]">
              {IMPUESTO.sigla} incluido: <span className="font-semibold tabular-nums">{dinero(iva)}</span>
              <span className="text-humo"> · sin {IMPUESTO.sigla}: </span>
              <span className="font-semibold tabular-nums">{dinero(total - iva)}</span>
            </p>
          ) : null}
        </div>
      )}
    </Campo>
  );
}
