import { useId } from "react";

export const CLASE_INPUT =
  "min-h-12 w-full rounded-2xl border border-arena bg-papel px-4 text-base text-tinta placeholder:text-humo/70 focus:border-musgo focus:outline-none focus:ring-2 focus:ring-musgo/25 disabled:opacity-60";

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {etiqueta}
      </label>
      {children(id)}
      {error ? <p className="text-sm text-rojo">{error}</p> : ayuda ? <p className="text-[0.8125rem] text-humo">{ayuda}</p> : null}
    </div>
  );
}
