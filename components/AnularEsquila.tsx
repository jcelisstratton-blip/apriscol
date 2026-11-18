"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { anularEsquila } from "@/app/(app)/esquila/actions";

/** Anular una esquila mal registrada: pide confirmar y dice qué pasa (queda guardada, pero ya no cuenta para los plazos de las ovejas). */
export function AnularEsquila({ esquilaId, resumen }: { esquilaId: string; resumen: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const anular = () =>
    iniciar(async () => {
      setError(null);
      const r = await anularEsquila(esquilaId);
      if (!r.ok) return setError(r.error);
      toast.exito("Esquila anulada");
      router.push("/esquila");
      router.refresh();
    });

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-rojo underline-offset-4 hover:underline">
        <Ban className="size-4" strokeWidth={2} aria-hidden="true" /> Anular esta esquila
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <p className="text-[0.9375rem]">
        Se anulará <strong className="[overflow-wrap:anywhere]">{resumen}</strong>. Deja de contar para el plazo de cada oveja y para sus kilos de vellón. Después puedes registrar la esquila correcta.
      </p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
        <Boton variante="peligro" onClick={anular} pendiente={pendiente} cargando="Anulando…">Sí, anular</Boton>
      </div>
    </div>
  );
}
