import { Pause, Play } from "lucide-react";

/** Pausar o reanudar una fila que se mueve sola (`useDesplazamientoContinuo`). Todo contenido que se mueve solo debe poder detenerse. */
export function BotonPausaMovimiento({ pausado, onClick }: { pausado: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={pausado ? "Reanudar el movimiento de las tarjetas" : "Pausar el movimiento de las tarjetas"}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-papel text-musgo ring-1 ring-arena transition hover:bg-arena/60 active:scale-95"
    >
      {pausado ? <Play className="size-4" strokeWidth={2} aria-hidden="true" /> : <Pause className="size-4" strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
