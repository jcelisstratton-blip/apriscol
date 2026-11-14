"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { vistosDesde } from "@/lib/tutoriales";

const CLAVE = "apriscol:tutoriales-vistos";
const EVENTO = "apriscol:tutoriales-vistos";

const suscribir = (avisar: () => void) => {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
};
const leerAlmacen = () => {
  try {
    return localStorage.getItem(CLAVE) ?? "[]";
  } catch {
    return "[]";
  }
};

/**
 * Qué tutoriales ya vio esta persona. Vive en su navegador (no en la base): lo comparten la pantalla de Tutoriales y el aviso de Hoy, y se mantienen al día entre
 * pestañas. Sin almacenamiento (ventana privada) se recuerda solo en esta visita.
 */
export function useTutorialesVistos() {
  const guardado = useSyncExternalStore(suscribir, leerAlmacen, () => "[]");
  const [soloAhora, setSoloAhora] = useState<number[]>([]);
  const vistos = useMemo(() => new Set([...vistosDesde(guardado), ...soloAhora]), [guardado, soloAhora]);

  const marcarVisto = (numero: number) => {
    if (vistos.has(numero)) return;
    setSoloAhora((previo) => [...previo, numero]);
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...new Set([...vistosDesde(leerAlmacen()), numero])].sort((a, b) => a - b)));
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      /* sin almacenamiento: queda solo en esta visita */
    }
  };
  return { vistos, marcarVisto };
}
