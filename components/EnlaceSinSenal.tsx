import { WifiOff } from "lucide-react";
import { RUTA_CAMPO } from "@/lib/campo";

/**
 * Atajo a «Registrar sin señal» desde la captura de leche y la pesada de Ceba. Enlace común (no `Link`): si la señal ya se cayó, la navegación
 * del navegador la atiende el service worker y abre la pantalla guardada. Sin `"use client"`.
 */
export function EnlaceSinSenal({ texto }: { texto: string }) {
  return (
    <a href={RUTA_CAMPO} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
      <WifiOff className="size-4" strokeWidth={2} aria-hidden="true" /> {texto}
    </a>
  );
}
