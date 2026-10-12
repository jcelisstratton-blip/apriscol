"use client";

import { useState, useTransition } from "react";
import { ChipsTurnos } from "@/components/ChipsTurnos";
import { useToast } from "@/components/Toast";
import { programarOrdeno } from "@/app/(app)/hato/actions";
import { turnosDe, type Turno } from "@/lib/ordeno";

/** Los turnos de ordeño de una hembra, en su ficha: cada toque se guarda al instante. */
export function TurnosAnimal({ animalId, programados, puedeEditar }: { animalId: string; programados: string[] | null; puedeEditar: boolean }) {
  const toast = useToast();
  const [turnos, setTurnos] = useState<Turno[]>(turnosDe(programados));
  const [, iniciar] = useTransition();

  const cambiar = (nuevos: Turno[]) => {
    const anteriores = turnos;
    setTurnos(nuevos);
    iniciar(async () => {
      const r = await programarOrdeno(animalId, nuevos);
      if (!r.ok) {
        setTurnos(anteriores);
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <ChipsTurnos valor={turnos} onCambio={cambiar} deshabilitado={!puedeEditar} />
      <p className="text-[0.8125rem] text-humo">
        {turnos.length === 0 ? "No se ordeña en ningún turno por ahora." : "Aparece en la lista de Leche de estos turnos."}
        {puedeEditar ? "" : " Solo el propietario o un administrador puede cambiarlos."}
      </p>
    </div>
  );
}
