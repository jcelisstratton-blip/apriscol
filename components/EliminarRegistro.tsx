"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";

/**
 * Eliminar un registro: pide confirmar y dice qué se pierde. `accion` hace el borrado y devuelve a dónde ir después
 * (`destino`) o un error en lenguaje de persona.
 */
export function EliminarRegistro({
  etiqueta,
  resumen,
  consecuencia,
  accion,
  destino,
  mensaje,
}: {
  /** Texto del botón: «Eliminar este producto». */
  etiqueta: string;
  /** Qué se va a eliminar, para el aviso de confirmación. */
  resumen: string;
  /** Lo que además se pierde o cambia (se agrega tras el resumen). */
  consecuencia?: string;
  accion: () => Promise<{ ok: true; destino?: string } | { ok: false; error: string }>;
  /** A dónde ir al terminar si la acción no dice otra cosa. */
  destino: string;
  /** Confirmación pasajera: «Producto eliminado». */
  mensaje: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const eliminar = () =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (!r.ok) return setError(r.error);
      toast.exito(mensaje);
      router.push(r.destino ?? destino);
      router.refresh();
    });

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-rojo underline-offset-4 hover:underline"
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" /> {etiqueta}
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <p className="text-[0.9375rem]">
        Se eliminará <strong className="[overflow-wrap:anywhere]">{resumen}</strong>
        {consecuencia ? `. ${consecuencia}` : ""}. No se puede deshacer.
      </p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
        <Boton variante="peligro" onClick={eliminar} pendiente={pendiente} cargando="Eliminando…">Sí, eliminar</Boton>
      </div>
    </div>
  );
}
