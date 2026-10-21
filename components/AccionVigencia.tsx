"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { ConfirmarPago } from "@/components/ConfirmarPago";
import { fijarVigencia, marcarCuentaPruebas } from "@/app/(admin)/admin/planes/actions";
import type { PlanId } from "@/lib/tipos";

/** Superadmin: renovar el plan que ya tiene (confirmado el pago), fijar la fecha a mano o dejarla sin vencimiento. */
export function AccionVigencia({ fincaId, plan, venceEn, correo, cuentaPruebas }: { fincaId: string; plan: PlanId; venceEn: string | null; correo: string; cuentaPruebas: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, iniciar] = useTransition();
  const [fecha, setFecha] = useState(venceEn ?? "");
  const [error, setError] = useState<string | null>(null);

  const correr = (accion: () => Promise<{ ok: true; detalle: string } | { ok: false; error: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (!r.ok) return setError(r.error);
      toast.exito(r.detalle);
      router.refresh();
    });

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ConfirmarPago fincaId={fincaId} plan={plan} periodo="mensual" variante="secundario">
          Pago recibido · 1 mes
        </ConfirmarPago>
        <ConfirmarPago fincaId={fincaId} plan={plan} periodo="anual" variante="secundario">
          Pago recibido · 1 año
        </ConfirmarPago>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`vence-${fincaId}`}>
          Último día pagado
        </label>
        <input
          id={`vence-${fincaId}`}
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-arena bg-papel px-3 text-base"
        />
        <Boton type="button" ancho={false} variante="fantasma" disabled={pendiente || !fecha} onClick={() => correr(() => fijarVigencia(fincaId, fecha))}>
          Fijar fecha
        </Boton>
        <Boton type="button" ancho={false} variante="fantasma" disabled={pendiente || !venceEn} onClick={() => correr(() => fijarVigencia(fincaId, null))}>
          Sin vencimiento
        </Boton>
      </div>
      {correo ? (
        <Boton type="button" ancho={false} variante="fantasma" disabled={pendiente} onClick={() => correr(() => marcarCuentaPruebas(correo, !cuentaPruebas))}>
          {cuentaPruebas ? "Quitar marca de cuenta de pruebas" : "Marcar como cuenta de pruebas"}
        </Boton>
      ) : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
