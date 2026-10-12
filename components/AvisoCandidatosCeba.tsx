import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";

/** Una línea que avisa cuántos animales conviene pasar a ceba y lleva a la lista. No aparece si no hay ninguno. */
export function AvisoCandidatosCeba({ tocan, proximos }: { tocan: number; proximos: number }) {
  if (tocan + proximos === 0) return null;
  const principal =
    tocan > 0 ? `${tocan} ${tocan === 1 ? "animal ya le toca" : "animales ya les toca"} pasar a ceba` : `${proximos} ${proximos === 1 ? "animal está próximo" : "animales están próximos"} a pasar a ceba`;
  const detalle = tocan > 0 && proximos > 0 ? `Y ${proximos} ${proximos === 1 ? "próximo" : "próximos"}.` : "Mira cuáles son y qué hacer con cada uno.";
  return (
    <Link href="/carne?vista=candidatos" className="flex items-center gap-3 rounded-2xl bg-papel px-4 py-3 ring-1 ring-arena transition hover:ring-musgo/40">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ambar/15 text-ambar">
        <Scale className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold [overflow-wrap:anywhere]">{principal}</span>
        <span className="block text-sm text-humo">{detalle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-humo" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
