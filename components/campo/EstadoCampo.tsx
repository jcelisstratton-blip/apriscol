import { Check, CloudUpload, TriangleAlert } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import type { RegistroCampo } from "@/lib/campo";

/** En qué va un registro del celular: por enviar, enviado o con error. Sin `"use client"`: solo dibuja. */
export function InsigniaCampo({ r }: { r: RegistroCampo }) {
  if (r.estado === "enviado") return <Insignia tono="ok">Enviado</Insignia>;
  if (r.estado === "error") return <Insignia tono="alerta">Con error</Insignia>;
  return <Insignia tono="aviso">Por enviar</Insignia>;
}

/** El círculo de la fila: gota o báscula si falta, nube si espera la señal, check si se envió, alerta si hubo error. */
export function IconoCampo({ r, vacio }: { r: RegistroCampo | undefined; vacio: React.ReactNode }) {
  const base = "grid size-11 shrink-0 place-items-center rounded-full";
  if (!r) return <span className={`${base} bg-arena text-humo`}>{vacio}</span>;
  if (r.estado === "enviado") return <span className={`${base} bg-ok/15 text-ok`}><Check className="size-5" strokeWidth={2.4} aria-hidden="true" /></span>;
  if (r.estado === "error") return <span className={`${base} bg-rojo/12 text-rojo`}><TriangleAlert className="size-5" strokeWidth={2} aria-hidden="true" /></span>;
  return <span className={`${base} bg-ambar/15 text-ambar`}><CloudUpload className="size-5" strokeWidth={2} aria-hidden="true" /></span>;
}
