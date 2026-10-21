"use client";

import { ConfirmarPago } from "@/components/ConfirmarPago";
import { nombrePlan } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

/** Superadmin: activa el plan pedido para esa finca una vez confirmado el pago (con vista previa y registro del pago). */
export function AccionActivarPlan({ fincaId, plan, periodo }: { fincaId: string; plan: PlanId; periodo: "mensual" | "anual" }) {
  return (
    <ConfirmarPago fincaId={fincaId} plan={plan} periodo={periodo}>
      Activar {nombrePlan(plan)} · {periodo === "anual" ? "1 año" : "1 mes"}
    </ConfirmarPago>
  );
}
