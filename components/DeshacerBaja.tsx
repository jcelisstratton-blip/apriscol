"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { deshacerBaja } from "@/app/(app)/hato/actions";

/** Deshace una baja registrada por error: el animal vuelve al hato. Pide confirmar antes. */
export function DeshacerBaja({ animalId, etiqueta, esHembra }: { animalId: string; etiqueta: string; esHembra: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const deshacer = () =>
    iniciar(async () => {
      setError(null);
      const r = await deshacerBaja(animalId);
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiqueta} volvió al hato${esHembra ? ". Si estaba en ordeño, agrégala de nuevo desde Leche" : ""}`);
      setConfirmando(false);
      router.refresh();
    });

  if (!confirmando) {
    return (
      <Boton variante="secundario" onClick={() => setConfirmando(true)}>
        Deshacer la baja
      </Boton>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <p className="text-[0.9375rem]">¿Fue un error? El animal vuelve al hato como activo y se borran los datos de su salida.</p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
        <Boton variante="peligro" onClick={deshacer} pendiente={pendiente} cargando="Deshaciendo…">Sí, deshacer</Boton>
      </div>
    </div>
  );
}
