import { FAMACHA } from "@/lib/famacha";

/** Ilustración del ojo con el párpado inferior bajado, pintado con el color de la mucosa de cada puntaje FAMACHA. Es de referencia: la luz y el animal cambian el tono. */
export function OjoFamacha({ puntaje, className = "" }: { puntaje: number; className?: string }) {
  const color = FAMACHA[puntaje]?.mucosa ?? "#e0626f";
  const pálido = puntaje >= 4;
  return (
    <svg viewBox="0 0 72 44" className={className} aria-hidden="true" focusable="false">
      <rect width="72" height="44" rx="10" fill="#7a6652" />
      <path d="M7 21 Q36 0 65 21 Q36 27 7 21Z" fill="#2b2118" />
      <ellipse cx="36" cy="14.5" rx="11" ry="8" fill="#b9803a" />
      <rect x="27.5" y="13" width="17" height="3.6" rx="1.8" fill="#14100c" />
      <path d="M9 23 Q36 47 63 23 Q36 31 9 23Z" fill={color} stroke="#2b2118" strokeOpacity="0.35" strokeWidth="0.8" />
      {pálido ? (
        <g stroke="#d9a6a0" strokeWidth="0.6" fill="none" strokeLinecap="round" opacity={puntaje === 4 ? 0.9 : 0.5}>
          <path d="M22 28 Q30 33 36 32" />
          <path d="M50 28 Q42 33 36 32" />
          <path d="M36 32 L36 35.5" />
        </g>
      ) : null}
      <ellipse cx="36" cy="30.5" rx="11" ry="1.8" fill="#fff" opacity="0.28" />
    </svg>
  );
}
