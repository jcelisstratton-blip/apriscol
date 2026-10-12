"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { cancelarPrograma } from "@/app/(app)/sanidad/actions";

/** Cancelar una programación sanitaria: pide confirmar y explica qué pasa (queda en el historial y los animales dejan de esperarla). */
export function CancelarPrograma({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cancelar = () =>
    iniciar(async () => {
      setError(null);
      const r = await cancelarPrograma(id);
      if (!r.ok) return setError(r.error);
      toast.exito("Programación cancelada");
      setAbierta(false);
      router.refresh();
    });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierta(true);
        }}
        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-humo underline-offset-4 hover:text-rojo hover:underline"
      >
        Cancelar
      </button>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="¿Cancelar la programación?"
        pie={
          <div className="space-y-2">
            <Boton variante="peligro" onClick={cancelar} pendiente={pendiente} cargando="Cancelando…">
              Sí, cancelar
            </Boton>
            <Boton variante="fantasma" onClick={() => setAbierta(false)} disabled={pendiente}>
              No, dejarla
            </Boton>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[0.9375rem]">
            Vas a cancelar <strong className="[overflow-wrap:anywhere]">{nombre}</strong>. Los animales dejan de esperar esta aplicación; lo que ya se aplicó con ella no cambia.
          </p>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
