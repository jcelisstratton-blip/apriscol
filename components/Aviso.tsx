import { CheckCircle2, Info, TriangleAlert, OctagonAlert } from "lucide-react";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

type Tipo = "info" | "exito" | "atencion" | "error";

/**
 * Jerarquía de mensajes: info y éxito son una nota (icono + texto, sin caja);
 * atención y error llevan un recuadro sutil con hilo de color.
 */
export function Aviso({ tipo = "info", children, className = "" }: { tipo?: Tipo; children: React.ReactNode; className?: string }) {
  const texto = tipo === "error" && typeof children === "string" ? mensajeAmigable(children) : children;
  const Icono = { info: Info, exito: CheckCircle2, atencion: TriangleAlert, error: OctagonAlert }[tipo];
  const color = { info: "text-humo", exito: "text-ok", atencion: "text-ambar", error: "text-rojo" }[tipo];
  const caja =
    tipo === "atencion"
      ? "border-l-[3px] border-ambar bg-ambar/8 rounded-r-xl px-3.5 py-3"
      : tipo === "error"
        ? "border-l-[3px] border-rojo bg-rojo/8 rounded-r-xl px-3.5 py-3"
        : "";
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 text-[0.9375rem] leading-snug ${caja} ${className}`}
    >
      <Icono className={`mt-0.5 size-[1.125rem] shrink-0 ${color}`} strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 [overflow-wrap:anywhere]">{texto}</div>
    </div>
  );
}
