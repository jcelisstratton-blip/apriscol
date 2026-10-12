"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Boton } from "@/components/Boton";
import { CLASE_INPUT } from "@/components/Campo";
import { useToast } from "@/components/Toast";
import { guardarPartosPrevios } from "@/app/(app)/reproduccion/actions";

/**
 * Cuántos partos había tenido la hembra antes de registrarlos aquí. Es el dato que falta en las hembras que llegaron de otro lado:
 * de él (más los partos que se registren) sale el número de partos que usa el aviso de pasar a ceba.
 */
export function PartosPrevios({ animalId, previos, registrados, puedeEditar }: { animalId: string; previos: number | null; registrados: number; puedeEditar: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(previos != null ? String(previos) : "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await guardarPartosPrevios({ animalId, partos: valor });
      if (!r.ok) return setError(r.error);
      toast.exito("Partos guardados");
      setEditando(false);
      router.refresh();
    });

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.9375rem]">
        <span className="min-w-0 text-humo">
          {previos != null ? `Antes de usar Apriscol: ${previos}` : "No sabemos cuántos partos tuvo antes de usar Apriscol."}
          {registrados > 0 ? ` · Registrados aquí: ${registrados}` : ""}
        </span>
        {puedeEditar ? (
          <button type="button" onClick={() => setEditando(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
            <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> {previos != null ? "Corregir" : "Completar"}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-lana p-3">
      <label htmlFor="partos-previos" className="block text-sm font-semibold">
        Partos que ya había tenido
      </label>
      <p className="text-[0.8125rem] text-humo">Cuenta todos los que sabes que tuvo hasta hoy, sin contar los que registres aquí desde ahora. Déjalo vacío si no lo sabes.</p>
      <input id="partos-previos" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Ej. 3" className={CLASE_INPUT} />
      {error ? <p className="text-sm text-rojo">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => { setEditando(false); setError(null); }} disabled={pendiente}>Cancelar</Boton>
        <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…">Guardar</Boton>
      </div>
    </div>
  );
}
