"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { useToast } from "@/components/Toast";
import { marcarNovedad } from "@/app/(app)/novedades/actions";
import type { EstadoNovedad } from "@/lib/novedades";

/** Lo que hace quien revisa una novedad: marcarla vista o atendida, o registrarla de verdad en Sanidad. */
export function AccionesNovedad({ id, estado, registrar, alCambiar }: { id: string; estado: EstadoNovedad; registrar: string; alCambiar?: () => void }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const cambiar = (nuevo: EstadoNovedad) =>
    iniciar(async () => {
      setError(null);
      const r = await marcarNovedad(id, nuevo);
      if (!r.ok) return setError(r.error);
      alCambiar?.();
      toast.exito(nuevo === "atendida" ? "Novedad atendida" : nuevo === "vista" ? "Novedad vista" : "Novedad marcada como nueva");
    });
  const clase = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-arena hover:bg-lana disabled:opacity-60";
  return (
    <div className="space-y-2">
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="flex flex-wrap gap-2">
        {estado === "nueva" ? (
          <button type="button" disabled={pendiente} onClick={() => cambiar("vista")} className={clase}>
            <Eye className="size-4" strokeWidth={2} aria-hidden="true" /> Marcar como vista
          </button>
        ) : null}
        {estado !== "atendida" ? (
          <button type="button" disabled={pendiente} onClick={() => cambiar("atendida")} className={clase}>
            <Check className="size-4" strokeWidth={2} aria-hidden="true" /> Marcar como atendida
          </button>
        ) : (
          <button type="button" disabled={pendiente} onClick={() => cambiar("nueva")} className={clase}>
            Volver a abrir
          </button>
        )}
        <Link href={registrar} className={`${clase} text-musgo`}>
          Registrar de verdad
        </Link>
      </div>
    </div>
  );
}
