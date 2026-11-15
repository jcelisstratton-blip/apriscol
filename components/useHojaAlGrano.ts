"use client";

import { useEffect, useState } from "react";
import { EVENTO_ABRIR_AL_GRANO, marcarAlGranoVisto } from "@/lib/al-grano";

/**
 * El estado de la hoja «Al grano» de un menú. La barra de abajo (`escritorio` falso) y el menú lateral (verdadero) están los dos en la página y uno se oculta con CSS:
 * el aviso de Hoy pide abrirla con un evento que dice cuál se está viendo, para que se abra solo la que corresponde. Abrirla cuenta como «ya la conozco».
 */
export function useHojaAlGrano(escritorio: boolean) {
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    const abrir = (e: Event) => {
      const detalle = (e as CustomEvent<{ escritorio?: boolean }>).detail;
      if (Boolean(detalle?.escritorio) === escritorio) setAbierta(true);
    };
    window.addEventListener(EVENTO_ABRIR_AL_GRANO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_AL_GRANO, abrir);
  }, [escritorio]);
  return {
    abierta,
    abrir: () => {
      marcarAlGranoVisto();
      setAbierta(true);
    },
    cerrar: () => setAbierta(false),
  };
}
