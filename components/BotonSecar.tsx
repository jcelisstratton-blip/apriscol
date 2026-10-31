"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { sacarDelOrdeno } from "@/app/(app)/leche/actions";

/** Seca a la hembra: la saca del ordeño y cierra su lactancia. Pide confirmar antes (se puede volver a poner en el ordeño). */
export function BotonSecar({ animalId, etiqueta }: { animalId: string; etiqueta: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const secar = () =>
    iniciar(async () => {
      setError(null);
      const r = await sacarDelOrdeno(animalId);
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiqueta} quedó seca: ya no se ordeña`);
      setConfirmando(false);
      router.refresh();
    });

  if (!confirmando) {
    return (
      <Boton variante="secundario" onClick={() => setConfirmando(true)}>
        Secar (sacar del ordeño)
      </Boton>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <p className="text-[0.9375rem]">¿Secar a {etiqueta}? Deja de ordeñarse y su lactancia queda cerrada hoy. Puedes volver a ponerla en el ordeño después.</p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>
          Cancelar
        </Boton>
        <Boton onClick={secar} pendiente={pendiente} cargando="Guardando…">
          Sí, secar
        </Boton>
      </div>
    </div>
  );
}
