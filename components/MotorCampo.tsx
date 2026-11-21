"use client";

import { useEffect } from "react";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import { RUTA_CAMPO } from "@/lib/campo";
import { prepararPantallaSinSenal } from "@/lib/offline/campo-envio";
import { useBandejaCampo } from "@/lib/offline/useBandejaCampo";

/**
 * Va en el panel (layout de la app, con sesión): mantiene al día la copia de la finca para registrar sin señal, envía solo lo guardado en el
 * celular y deja lista la pantalla `/campo` para abrirla sin conexión. Si hay algo sin enviar o con error, lo dice con una etiqueta flotante
 * que lleva a la bandeja. No dibuja nada cuando todo está enviado.
 */
export function MotorCampo({ usuarioId, fincaId }: { usuarioId: string; fincaId: string }) {
  const toast = useToast();
  const { resumen, referencia, enLinea } = useBandejaCampo({ usuarioId, fincaId }, toast);
  const puedeAlgo = Boolean(referencia && (referencia.puede.leche || referencia.puede.pesos || referencia.puede.reproduccion || referencia.puede.hato || referencia.puede.sanidad || referencia.puede.corrales || referencia.puede.compras || referencia.puede.ventas || referencia.puede.alimento));

  useEffect(() => {
    if (puedeAlgo && enLinea) prepararPantallaSinSenal();
  }, [puedeAlgo, enLinea]);

  const { porEnviar, conError } = resumen;
  if (porEnviar === 0 && conError === 0) return null;
  const texto = conError > 0 ? `${conError} con error` : porEnviar === 1 ? "1 sin enviar" : `${porEnviar} sin enviar`;
  return (
    // Enlace común (no `Link`): así la pantalla se abre aunque no haya señal (la sirve el service worker).
    <a
      href={`${RUTA_CAMPO}#bandeja`}
      className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg ring-1 lg:bottom-6 lg:right-6 ${
        conError > 0 ? "bg-papel text-rojo ring-rojo/30" : "bg-papel text-tinta ring-arena"
      }`}
    >
      {conError > 0 ? <TriangleAlert className="size-4" strokeWidth={2} aria-hidden="true" /> : <CloudUpload className="size-4 text-musgo" strokeWidth={2} aria-hidden="true" />}
      {texto}
      <span className="sr-only">: ver lo guardado en el celular</span>
    </a>
  );
}
