import Image from "next/image";

/** Logo de Apriscol: el escudo con la oveja, la cabra y el mapa de Colombia (`public/logo.webp`). El tamaño lo da `className`. */
export function Isotipo({ className = "size-9", prioridad = false }: { className?: string; prioridad?: boolean }) {
  return <Image src="/logo.webp" alt="" width={112} height={112} priority={prioridad} className={`shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Isotipo />
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">Apriscol</span>
    </span>
  );
}
