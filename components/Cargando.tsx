import { Isotipo } from "@/components/Marca";

/** Espera corta o en línea, con el isotipo animado. */
export function Cargando({ texto, pequeno = false }: { texto?: string; pequeno?: boolean }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2.5 ${pequeno ? "" : "py-6"}`}>
      <Isotipo className={`${pequeno ? "size-5" : "size-8"} anim-pulso`} />
      {texto ? <span className="text-sm font-medium opacity-80">{texto}</span> : <span className="sr-only">Cargando</span>}
    </span>
  );
}

export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`anim-pulso rounded-xl bg-arena ${className}`} aria-hidden="true" />;
}

export function EsqueletoFilas({ filas = 6 }: { filas?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true">
      {Array.from({ length: filas }).map((_, i) => (
        <Esqueleto key={i} className="h-[4.25rem] w-full" />
      ))}
    </div>
  );
}
