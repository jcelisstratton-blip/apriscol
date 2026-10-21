"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { anularPago } from "@/app/(admin)/admin/pagos/actions";

/** Superadmin: anular el último pago de una finca (plan, vigencia y activación vuelven a como estaban). El motivo es obligatorio. */
export function AccionAnularPago({ pagoId, finca }: { pagoId: string; finca: string }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ejecutar = () =>
    iniciar(async () => {
      setError(null);
      const r = await anularPago(pagoId, motivo);
      if (!r.ok) return setError(r.error);
      toast.exito(r.detalle);
      setAbierta(false);
      router.refresh();
    });

  return (
    <>
      <Boton type="button" ancho={false} variante="fantasma" onClick={() => { setMotivo(""); setError(null); setAbierta(true); }}>
        <Undo2 className="size-4" strokeWidth={2.2} aria-hidden="true" /> Anular pago
      </Boton>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="¿Anular este pago?"
        pie={
          <Boton type="button" variante="peligro" onClick={ejecutar} pendiente={pendiente} cargando="Anulando…" disabled={motivo.trim().length < 5}>
            Anular y devolver la finca a como estaba
          </Boton>
        }
      >
        <div className="space-y-3.5">
          <p className="text-[0.9375rem] [overflow-wrap:anywhere]">
            {finca} vuelve al plan y a la vigencia que tenía antes de este pago. Úsalo si el pago no llegó o se confirmó por error. Si ya había una comisión de referidos, esa se revisa aparte.
          </p>
          <Campo etiqueta="Motivo" ayuda="Obligatorio. Queda en la bitácora.">
            {(id) => <textarea id={id} rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
