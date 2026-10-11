"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { revertirImportacion } from "@/app/(app)/admin/importaciones/actions";

export function AccionRevertir({ id, animales }: { id: string; animales: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, iniciar] = useTransition();
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = () =>
    iniciar(async () => {
      setError(null);
      const r = await revertirImportacion(id);
      if (!r.ok) return setError(r.error);
      toast.exito(r.detalle ?? "Importación revertida.");
      setAbierta(false);
      router.refresh();
    });

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierta(true)}>
        <Undo2 className="size-4" strokeWidth={2.2} /> Revertir importación
      </Boton>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="¿Revertir esta importación?"
        pie={
          <Boton variante="peligro" onClick={ejecutar} pendiente={pendiente} cargando="Revirtiendo…">
            Retirar {animales} animales de la finca
          </Boton>
        }
      >
        <div className="space-y-3">
          <p className="text-[0.9375rem]">
            Úsalo solo si alguien trajo animales que no son suyos. Los animales se retiran de esa finca y quedan libres para que su
            verdadero dueño los traiga. Sus registros asociados (ordeños, sanidad) quedan ocultos junto con ellos.
          </p>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
