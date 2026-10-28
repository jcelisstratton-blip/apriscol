"use client";

import { Copy, Share2 } from "lucide-react";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";

/** Copia el enlace al portapapeles y lo comparte con el menú del teléfono (si no hay, lo copia). Una sola definición para todas las pantallas de invitaciones. */
export function useCompartirEnlace() {
  const toast = useToast();
  const copiar = async (enlace: string) => {
    try {
      await navigator.clipboard.writeText(enlace);
      toast.exito("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
    }
  };
  const compartir = async (enlace: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Invitación a Apriscol", text: "Te invito a mi finca en Apriscol:", url: enlace });
      } catch {
        /* la persona canceló */
      }
    } else {
      await copiar(enlace);
    }
  };
  return { copiar, compartir };
}

/** El enlace de una invitación con sus dos botones: «Copiar» y «Enviar». */
export function EnlaceInvitacion({ enlace }: { enlace: string }) {
  const { copiar, compartir } = useCompartirEnlace();
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-papel px-3 py-2 text-sm [overflow-wrap:anywhere]">{enlace}</p>
      <div className="grid grid-cols-2 gap-2">
        <Boton type="button" variante="secundario" onClick={() => copiar(enlace)}>
          <Copy className="size-4" /> Copiar
        </Boton>
        <Boton type="button" onClick={() => compartir(enlace)}>
          <Share2 className="size-4" /> Enviar
        </Boton>
      </div>
    </div>
  );
}
