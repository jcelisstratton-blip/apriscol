"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Muestra un aviso pasajero «Cambios guardados» cuando la página llega con `?guardado=1` (tras editar algo)
 * y limpia ese parámetro de la dirección para que no reaparezca al recargar.
 */
export function AvisoGuardado({ activo, texto = "Cambios guardados" }: { activo: boolean; texto?: string }) {
  const toast = useToast();
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (!activo) return;
    toast.exito(texto);
    router.replace(ruta, { scroll: false });
  }, [activo, texto, ruta, router, toast]);

  return null;
}
