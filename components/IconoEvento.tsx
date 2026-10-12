import { Bug, ClipboardList, Footprints, Pill, Scissors, Syringe, Waves } from "lucide-react";
import type { TipoEvento } from "@/lib/tipos";

const ICONOS = { vacunacion: Syringe, desparasitacion: Bug, tratamiento: Pill, podologia: Footprints, pediluvio: Waves, cirugia: Scissors, otro: ClipboardList } as const;

/** Icono redondo de un tipo de evento sanitario. */
export function IconoEvento({ tipo }: { tipo: TipoEvento | null }) {
  const Icono = ICONOS[tipo ?? "otro"];
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-musgo/12 text-musgo">
      <Icono className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
