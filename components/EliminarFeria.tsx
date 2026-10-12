"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { eliminarFeria } from "@/app/(app)/ferias/actions";

/** Elimina una feria con sus participaciones y fotos. Pide confirmar y dice qué se pierde. */
export function EliminarFeria({ feriaId, nombre, participaciones }: { feriaId: string; nombre: string; participaciones: number }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const eliminar = () =>
    iniciar(async () => {
      setError(null);
      const r = await eliminarFeria(feriaId);
      if (!r.ok) return setError(r.error);
      toast.exito("Feria eliminada");
      router.push("/hato");
      router.refresh();
    });

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-rojo underline-offset-4 hover:underline"
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" /> Eliminar esta feria
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <p className="text-[0.9375rem]">
        Se eliminará <strong className="[overflow-wrap:anywhere]">{nombre}</strong>
        {participaciones > 0
          ? ` y sus ${participaciones} ${participaciones === 1 ? "participación" : "participaciones"}, con las fotos de sus premios`
          : ""}
        . No se puede deshacer.
      </p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
        <Boton variante="peligro" onClick={eliminar} pendiente={pendiente} cargando="Eliminando…">Sí, eliminar</Boton>
      </div>
    </div>
  );
}
