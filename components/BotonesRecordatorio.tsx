"use client";

import { Copy, MessageCircle } from "lucide-react";
import { Boton } from "@/components/Boton";
import { useToast } from "@/components/Toast";
import { telefonoWhatsApp } from "@/lib/cobranza";

/** Recordatorio de cobro ya redactado: abrir WhatsApp con el texto listo (si el propietario dejó un celular) o copiarlo para enviarlo por donde sea. */
export function BotonesRecordatorio({ mensaje, telefono }: { mensaje: string; telefono: string }) {
  const toast = useToast();
  const numero = telefonoWhatsApp(telefono);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      toast.exito("Mensaje copiado.");
    } catch {
      toast.error("No se pudo copiar. Inténtalo de nuevo.");
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {numero ? (
        <a
          href={`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-musgo px-4 text-[0.9375rem] font-semibold text-sobre-musgo transition active:scale-[0.98]"
        >
          <MessageCircle className="size-4" strokeWidth={2} aria-hidden="true" /> Recordar por WhatsApp
        </a>
      ) : null}
      <Boton type="button" ancho={false} variante="secundario" onClick={copiar}>
        <Copy className="size-4" strokeWidth={2} aria-hidden="true" /> Copiar mensaje
      </Boton>
    </div>
  );
}
