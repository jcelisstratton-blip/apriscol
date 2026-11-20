import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resumenBandeja, SEGUNDOS_REINTENTO, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { escucharCampo, leerReferencia, listarRegistros } from "@/lib/offline/campo-db";
import { enviarPendientes, refrescarReferencia } from "@/lib/offline/campo-envio";

/**
 * El estado de la bandeja del celular y su envío automático, para los componentes de cliente (sin `"use client"`: es un gancho, nunca lo llama
 * el servidor). Envía al montar, al volver la señal (`online`), al volver a la pestaña y cada 30 s mientras haya algo por enviar.
 * `sesion`: la persona y la finca con sesión abierta (en el panel). En `/campo`, que puede abrirse sin señal, se toman de la copia guardada.
 */
export function useBandejaCampo(sesion: { usuarioId: string; fincaId: string } | null, avisos?: { exito: (t: string) => void; error: (t: string) => void }) {
  const [registros, setRegistros] = useState<RegistroCampo[]>([]);
  const [referencia, setReferencia] = useState<ReferenciaCampo | null | undefined>(undefined);
  const [enLinea, setEnLinea] = useState(true);
  const [sesionVencida, setSesionVencida] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);
  const avisosRef = useRef(avisos);
  useEffect(() => {
    avisosRef.current = avisos;
  });

  // Por valor, no por objeto: un objeto nuevo en cada render volvería a disparar el envío sin fin.
  const usuarioSesion = sesion?.usuarioId ?? null;
  const fincaSesion = sesion?.fincaId ?? null;
  const usuarioId = usuarioSesion ?? referencia?.usuario.id ?? null;

  const recargar = useCallback(async () => {
    const [r, ref] = await Promise.all([listarRegistros(), leerReferencia()]);
    setRegistros(r);
    setReferencia(ref);
  }, []);

  const ciclo = useCallback(
    async (forzarReferencia = false) => {
      if (ocupado.current) return;
      ocupado.current = true;
      try {
        const esperado = usuarioSesion && fincaSesion ? { usuarioId: usuarioSesion, fincaId: fincaSesion } : null;
        const ref = await refrescarReferencia(esperado, forzarReferencia);
        const quien = usuarioSesion ?? ref?.usuario.id;
        if (!quien) return;
        setEnviando(true);
        const r = await enviarPendientes(quien);
        if (!r) return;
        setSesionVencida(r.sesionVencida);
        if (r.enviados > 0) avisosRef.current?.exito(r.enviados === 1 ? "Se envió 1 registro guardado en el celular." : `Se enviaron ${r.enviados} registros guardados en el celular.`);
        if (r.conError > 0) avisosRef.current?.error(r.conError === 1 ? "Un registro no se pudo guardar. Revísalo en «Pendientes con error»." : `${r.conError} registros no se pudieron guardar. Revísalos en «Pendientes con error».`);
      } finally {
        ocupado.current = false;
        setEnviando(false);
        await recargar();
      }
    },
    [usuarioSesion, fincaSesion, recargar],
  );

  // Al montar y cada vez que cambia la bandeja (en esta pestaña o en otra).
  useEffect(() => {
    const t = setTimeout(() => void recargar(), 0);
    const dejar = escucharCampo(() => void recargar());
    return () => {
      clearTimeout(t);
      dejar();
    };
  }, [recargar]);

  // Enviar al abrir, al volver la señal y al volver a la pestaña.
  useEffect(() => {
    const actualizarRed = () => setEnLinea(navigator.onLine);
    const alVolver = () => {
      actualizarRed();
      void ciclo();
    };
    const alVerse = () => document.visibilityState === "visible" && void ciclo();
    const t = setTimeout(alVolver, 0);
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", actualizarRed);
    document.addEventListener("visibilitychange", alVerse);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", actualizarRed);
      document.removeEventListener("visibilitychange", alVerse);
    };
  }, [ciclo]);

  const resumen = useMemo(() => resumenBandeja(registros, usuarioId), [registros, usuarioId]);

  // Mientras haya algo por enviar, reintenta cada 30 s (la señal débil no avisa cuándo vuelve).
  useEffect(() => {
    if (resumen.porEnviar === 0) return;
    const id = setInterval(() => void ciclo(), SEGUNDOS_REINTENTO * 1000);
    return () => clearInterval(id);
  }, [resumen.porEnviar, ciclo]);

  return { registros, referencia, usuarioId, resumen, enLinea, enviando, sesionVencida, enviarAhora: () => ciclo(true), recargar };
}
