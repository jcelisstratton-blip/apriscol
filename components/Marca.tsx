/** Isotipo de Apriscol: el techo de dos aguas de un aprisco con una cría debajo. */
export function Isotipo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="13" className="fill-musgo" />
      <path
        d="M9 25.5 24 12.5l15 13"
        className="stroke-sobre-musgo"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 27v8.5h20V27" className="stroke-sobre-musgo" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="30.2" r="2.7" fill="var(--ocre)" />
    </svg>
  );
}

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Isotipo />
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">Apriscol</span>
    </span>
  );
}
