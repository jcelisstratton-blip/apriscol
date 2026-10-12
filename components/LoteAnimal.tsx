"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { asignarLote } from "@/app/(app)/carne/actions";

/** En la ficha de un animal: elegir (o cambiar) el lote de ceba en el que está. Se guarda al elegir. */
export function LoteAnimal({ animalId, loteId, lotes }: { animalId: string; loteId: string | null; lotes: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [valor, setValor] = useState<string>(loteId ?? "");
  const [, iniciar] = useTransition();

  const cambiar = (nuevo: string) => {
    const anterior = valor;
    setValor(nuevo);
    iniciar(async () => {
      const r = await asignarLote({ loteId: nuevo || null, animales: [animalId] });
      if (!r.ok) {
        setValor(anterior);
        return toast.error(r.error);
      }
      toast.exito(nuevo ? "Animal puesto en el lote" : "Animal sacado del lote");
      router.refresh();
    });
  };

  return (
    <Campo etiqueta="Lote de ceba">
      {(id) => (
        <Selector
          id={id}
          valor={valor}
          onCambio={(v) => cambiar(String(v))}
          titulo="Lote de ceba"
          placeholder="Sin lote"
          permitirVacio
          opciones={lotes.map((l) => ({ valor: l.id, etiqueta: l.nombre }))}
        />
      )}
    </Campo>
  );
}
