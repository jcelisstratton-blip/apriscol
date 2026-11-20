"use client";

import { useEffect } from "react";
import { borrarReferencia } from "@/lib/offline/campo-db";

/** Al cerrar sesión: borra del aparato la copia de la finca del registro sin señal (lo pendiente de enviar se conserva). */
export function LimpiarCampo() {
  useEffect(() => {
    void borrarReferencia();
  }, []);
  return null;
}
