"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { marcarCobro } from "@/app/(app)/hato/ventas/actions";
import type { OrigenVenta } from "@/lib/tipos";

/** Marca una venta como cobrada (o la devuelve a «por cobrar»). Sirve a la ficha de un animal vendido, igual que la lista de ventas. */
export function CobroVenta({ origen, id, cobrado }: { origen: OrigenVenta; id: string; cobrado: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cambiar = () =>
    iniciar(async () => {
      setError(null);
      const r = await marcarCobro(origen, id, !cobrado);
      if (!r.ok) return setError(r.error);
      toast.exito(cobrado ? "Venta devuelta a «por cobrar»" : "Venta marcada como cobrada");
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton variante={cobrado ? "secundario" : "primario"} onClick={cambiar} pendiente={pendiente} cargando="Guardando…">
        {cobrado ? "Devolver a «por cobrar»" : "Marcar como cobrada"}
      </Boton>
    </div>
  );
}
