"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { useToast } from "@/components/Toast";
import { agregarSemental, quitarHembra, quitarSemental } from "@/app/(app)/reproduccion/empadronamiento/actions";
import type { Especie } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };

/** Botón discreto «Quitar» de una hembra o un semental de una temporada abierta. */
export function QuitarDeEmp({ loteId, animalId, tipo, nombre }: { loteId: string; animalId: string; tipo: "hembra" | "semental"; nombre: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const quitar = () =>
    iniciar(async () => {
      setError(null);
      const r = await (tipo === "hembra" ? quitarHembra(loteId, animalId) : quitarSemental(loteId, animalId));
      if (!r.ok) return setError(r.error);
      toast.exito(`${nombre} salió de la temporada`);
      router.refresh();
    });
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={quitar}
        disabled={pendiente}
        aria-label={`Quitar a ${nombre} de la temporada`}
        className="grid size-11 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo disabled:opacity-50"
      >
        <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
      {error ? <span className="max-w-48 text-right text-xs text-rojo">{error}</span> : null}
    </span>
  );
}

/** Sumar otro semental a la temporada. */
export function AgregarSemental({ fincaId, loteId, especie }: { fincaId: string; loteId: string; especie: Especie }) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const elegir = (a: Ref | null) => {
    if (!a) return;
    iniciar(async () => {
      setError(null);
      const r = await agregarSemental(loteId, a.id);
      if (!r.ok) return setError(r.error);
      toast.exito("Semental agregado");
      setAbierto(false);
      router.refresh();
    });
  };
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
        <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar semental
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <SelectorAnimal nombre="semental" fincaId={fincaId} sexo="macho" especie={especie} titulo="Agregar semental" valor={null} onCambio={elegir} vacio="Elegir un macho de tu hato" />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
