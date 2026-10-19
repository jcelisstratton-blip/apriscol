"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { activarPlan } from "@/app/(admin)/admin/planes/actions";
import { nombrePlan } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

/** Superadmin: activa el plan pedido para esa finca una vez confirmado el pago. */
export function AccionActivarPlan({ fincaId, plan, periodo }: { fincaId: string; plan: PlanId; periodo: "mensual" | "anual" }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activar = () =>
    iniciar(async () => {
      setError(null);
      const r = await activarPlan(fincaId, plan, periodo);
      if (!r.ok) return setError(r.error);
      toast.exito(r.detalle);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <Boton type="button" onClick={activar} pendiente={pendiente} cargando="Activando…">
        <Check className="size-4" strokeWidth={2.4} aria-hidden="true" /> Activar {nombrePlan(plan)} · {periodo === "anual" ? "1 año" : "1 mes"}
      </Boton>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
