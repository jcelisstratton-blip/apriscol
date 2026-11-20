"use client";

import { useEffect } from "react";

/**
 * Registra `public/sw.js`, que muestra «Sin señal» (`public/offline.html`) cuando una navegación falla por la red.
 * Solo en producción (en desarrollo un service worker estorba al recargar) y sin efecto si el navegador no lo soporta.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
