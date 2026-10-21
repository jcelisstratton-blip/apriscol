"use client";

import { useArrastrarParaDesplazar } from "@/lib/arrastrar-para-desplazar";

/**
 * Fila que se desplaza de lado (chips, pestañas) y se difumina en el borde con más contenido. En el celular se desliza con el dedo; en el
 * computador también se arrastra con el mouse (`useArrastrarParaDesplazar`).
 */
export function FilaDesplazable({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, arrastrando, desborda, props } = useArrastrarParaDesplazar<HTMLDivElement>();
  return (
    <div
      ref={ref}
      {...props}
      className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)] ${arrastrando ? "cursor-grabbing select-none" : desborda ? "cursor-grab" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
        activo ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
      }`}
    >
      {children}
    </button>
  );
}
