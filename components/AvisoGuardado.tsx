"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Muestra un aviso pasajero «Cambios guardados» cuando la página llega con `?guardado=1` (tras editar algo)
 * y limpia ese parámetro de la dirección para que no reaparezca al recargar. Conserva el resto de la dirección (la pestaña elegida
 * en `?vista=…` y el ancla `#…`): quitar solo `guardado` no debe llevar a la persona a otra pantalla.
 */
export function AvisoGuardado({ activo, texto = "Cambios guardados" }: { activo: boolean; texto?: string }) {
  const toast = useToast();
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  useEffect(() => {
    if (!activo) return;
    toast.exito(texto);
    const resto = new URLSearchParams(parametros.toString());
    resto.delete("guardado");
    const consulta = resto.toString();
    router.replace(`${ruta}${consulta ? `?${consulta}` : ""}${window.location.hash}`, { scroll: false });
  }, [activo, texto, ruta, parametros, router, toast]);

  return null;
}
