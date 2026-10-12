import Link from "next/link";
import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import type { EscenaDef, PestanaTarjeta, Tono } from "@/lib/escenas";

const COLOR: Record<Tono, string> = {
  musgo: "var(--musgo)",
  ocre: "var(--ocre)",
  arcilla: "var(--rojo)",
  oliva: "var(--ok)",
  ambar: "var(--ambar)",
  grafito: "var(--humo)",
};

/** La «escena» de una tarjeta: un fondo con color, una trama suave, un icono grande que hace referencia al contenido y otro pequeño de compañía. */
export function Escena({ escena, alto = "h-16" }: { escena: EscenaDef; alto?: string }) {
  const { icono: Icono, extra: Extra, tono } = escena;
  return (
    <span
      aria-hidden="true"
      className={`relative grid w-full place-items-center overflow-hidden ${alto}`}
      style={{ "--c": COLOR[tono], background: "linear-gradient(145deg, color-mix(in oklab, var(--c) 38%, var(--papel)), color-mix(in oklab, var(--c) 11%, var(--papel)))" } as CSSProperties}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(color-mix(in oklab, var(--c) 34%, transparent) 1px, transparent 1.5px)", backgroundSize: "9px 9px", maskImage: "linear-gradient(135deg, transparent 15%, #000 95%)" }}
      />
      <span className="absolute -bottom-7 -right-5 size-20 rounded-full border-[9px]" style={{ borderColor: "color-mix(in oklab, var(--c) 16%, transparent)" }} />
      <span className="relative grid size-10 place-items-center rounded-2xl bg-papel/90 shadow-sm ring-1" style={{ color: "var(--c)", "--tw-ring-color": "color-mix(in oklab, var(--c) 28%, transparent)" } as CSSProperties}>
        <Icono className="size-5" strokeWidth={1.7} />
      </span>
      {Extra ? <Extra className="absolute right-2.5 top-2 size-4 rotate-12 opacity-60" strokeWidth={1.6} style={{ color: "var(--c)" }} /> : null}
    </span>
  );
}

/**
 * Una opción como tarjeta: una escena ilustrada arriba, el nombre, una línea que explica qué hay dentro y, si hace falta, un dato (un conteo).
 * Es un enlace (`href`) para cambiar de pantalla, o un botón (`onClick`) para elegir sin salir. No lleva `"use client"` a propósito: así una
 * página de servidor puede usarla con `href`; el `onClick` solo se pasa desde componentes de cliente.
 */
export function TarjetaOpcion({
  escena,
  titulo,
  detalle,
  dato,
  activo = false,
  href,
  onClick,
  tamano = "compacta",
  rol = "boton",
  deshabilitada = false,
}: {
  escena: EscenaDef;
  titulo: string;
  detalle?: string;
  dato?: string;
  activo?: boolean;
  href?: string;
  onClick?: () => void;
  /** «compacta» para una fila que se desplaza; «normal» llena la columna de una rejilla. */
  tamano?: "compacta" | "normal";
  /** «radio» cuando es una de varias opciones excluyentes de un formulario. */
  rol?: "boton" | "radio";
  deshabilitada?: boolean;
}) {
  const ancho = tamano === "compacta" ? "w-[9.5rem] shrink-0 snap-start" : "w-full min-w-0";
  const clases = `group relative flex ${ancho} flex-col overflow-hidden rounded-3xl text-left ring-1 transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98] disabled:opacity-50 ${
    activo ? "bg-musgo/[0.07] ring-2 ring-musgo" : "bg-papel ring-arena hover:ring-musgo/40"
  }`;
  const contenido = (
    <>
      <Escena escena={escena} alto={tamano === "compacta" ? "h-14" : "h-16"} />
      <span className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-2.5">
        <span className="font-display text-[0.9375rem] font-semibold leading-tight tracking-tight [hyphens:auto] [overflow-wrap:break-word]" lang="es">{titulo}</span>
        {detalle ? <span className="mt-1 text-xs leading-snug text-humo [overflow-wrap:anywhere]">{detalle}</span> : null}
        {dato ? <span className="mt-auto pt-2 font-mono text-[0.6875rem] tabular-nums tracking-tight text-humo/80">{dato}</span> : null}
      </span>
      {activo ? (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-musgo text-sobre-musgo shadow-md" aria-hidden="true">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-current={activo ? "page" : undefined} className={clases}>
        {contenido}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitada}
      {...(rol === "radio" ? { role: "radio", "aria-checked": activo } : { "aria-pressed": activo })}
      className={clases}
    >
      {contenido}
    </button>
  );
}

/**
 * Una fila de tarjetas: en el celular se desplaza de lado y se difumina en el borde con más contenido; en el computador (desde `lg`) se acomoda
 * en varias filas para que se vea todo sin desplazar.
 */
export function FilaTarjetas({ children, className = "", etiqueta }: { children: React.ReactNode; className?: string; etiqueta?: string }) {
  return (
    <div
      role={etiqueta ? "group" : undefined}
      aria-label={etiqueta}
      className={`no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 pt-1 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none] ${className}`}
    >
      {children}
    </div>
  );
}

/** Las pestañas de un módulo del menú, como tarjetas (la actual lleva el check). */
export function PestanasTarjetas({ pestanas, actual, className = "mb-3" }: { pestanas: PestanaTarjeta[]; actual: string; className?: string }) {
  return (
    <FilaTarjetas className={className} etiqueta="Secciones">
      {pestanas.map((p) => (
        <TarjetaOpcion key={p.valor} escena={p.escena} titulo={p.etiqueta} detalle={p.detalle} dato={p.dato} href={p.href} activo={actual === p.valor} />
      ))}
    </FilaTarjetas>
  );
}
