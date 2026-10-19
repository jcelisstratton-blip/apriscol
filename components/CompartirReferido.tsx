"use client";

import { Copy, Share2 } from "lucide-react";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";

/** El enlace de referidos, con «Copiar» y «Enviar» (la hoja de compartir del teléfono; en el computador, copia). */
export function CompartirReferido({ enlace, codigo }: { enlace: string; codigo: string }) {
  const toast = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      toast.exito("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
    }
  };

  const compartir = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Apriscol", text: "Maneja tu aprisco desde el celular con Apriscol:", url: enlace });
      } catch {
        /* la persona canceló */
      }
    } else {
      await copiar();
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-lana px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-humo">Tu código</p>
        <p className="font-display text-xl font-semibold tracking-widest">{codigo}</p>
      </div>
      <p className="rounded-xl bg-papel px-3 py-2 text-sm ring-1 ring-arena [overflow-wrap:anywhere]">{enlace}</p>
      <div className="grid grid-cols-2 gap-2">
        <Boton type="button" variante="secundario" onClick={copiar}>
          <Copy className="size-4" /> Copiar
        </Boton>
        <Boton type="button" onClick={compartir}>
          <Share2 className="size-4" /> Enviar
        </Boton>
      </div>
    </div>
  );
}
