"use client";

import { createContext, useCallback, useContext } from "react";
import { dinero, MONEDA_DEFECTO, monedaDe, type Moneda } from "@/lib/moneda";

const ContextoMoneda = createContext<string>(MONEDA_DEFECTO);

/** Entrega a los componentes de cliente la moneda de la finca activa (`app/(app)/layout.tsx`). */
export function ProveedorMoneda({ moneda, children }: { moneda: string; children: React.ReactNode }) {
  return <ContextoMoneda.Provider value={moneda}>{children}</ContextoMoneda.Provider>;
}

/** La moneda de la finca activa (código, nombre, símbolo…). */
export function useMoneda(): Moneda {
  return monedaDe(useContext(ContextoMoneda));
}

/** `dinero(valor)` ya en la moneda de la finca: `const dinero = useDinero(); dinero(12500)`. Con `vacio`, un valor ausente se escribe así («—»). */
export function useDinero(): (n: number | null | undefined, vacio?: string) => string {
  const codigo = useContext(ContextoMoneda);
  return useCallback((n, vacio) => dinero(n, codigo, vacio), [codigo]);
}
