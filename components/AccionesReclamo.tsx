"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CLASE_INPUT } from "@/components/Campo";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { aprobarReclamo, rechazarReclamo } from "@/app/(app)/admin/reclamos/actions";

export function AccionesReclamo({ id, animales }: { id: string; animales: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState<"aprobar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ejecutar = () =>
    iniciar(async () => {
      setError(null);
      const r = confirmando === "aprobar" ? await aprobarReclamo(id) : await rechazarReclamo(id, motivo);
      if (!r.ok) return setError(r.error);
      toast.exito(confirmando === "aprobar" ? (r.detalle ?? "Solicitud aprobada.") : "Solicitud rechazada.");
      setConfirmando(null);
      router.refresh();
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando("rechazar")}>
          <X className="size-4" strokeWidth={2.2} /> Rechazar
        </Boton>
        <Boton onClick={() => setConfirmando("aprobar")}>
          <Check className="size-4" strokeWidth={2.2} /> Aprobar
        </Boton>
      </div>

      <Sheet
        abierta={confirmando !== null}
        onCerrar={() => (pendiente ? undefined : setConfirmando(null))}
        titulo={confirmando === "aprobar" ? "¿Aprobar esta solicitud?" : "¿Rechazar esta solicitud?"}
        pie={
          <Boton
            variante={confirmando === "rechazar" ? "peligro" : "primario"}
            onClick={ejecutar}
            pendiente={pendiente}
            cargando={confirmando === "aprobar" ? "Trayendo animales…" : "Rechazando…"}
          >
            {confirmando === "aprobar" ? `Aprobar y traer ${animales} animales` : "Rechazar solicitud"}
          </Boton>
        }
      >
        <div className="space-y-3">
          {confirmando === "aprobar" ? (
            <p className="text-[0.9375rem]">
              Los {animales} animales de este titular pasarán a la finca que lo solicitó, con su pedigrí. Antes de aprobar, confirma que esa
              persona es quien dice ser.
            </p>
          ) : (
            <>
              <p className="text-[0.9375rem]">La persona verá el motivo en su pantalla.</p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={300}
                aria-label="Motivo del rechazo"
                placeholder="Motivo (opcional)"
                className={`${CLASE_INPUT} py-3`}
              />
            </>
          )}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
