/** Encabezado de pantalla: título grande a la izquierda, acciones (finca, botón) a la derecha. */
export function Encabezado({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-5">
      <div className="min-w-0">
        <h1 className="font-display text-[1.875rem] font-semibold leading-none tracking-tight">{titulo}</h1>
        {subtitulo ? <p className="mt-1.5 text-[0.9375rem] text-humo">{subtitulo}</p> : null}
      </div>
      {acciones ? <div className="flex min-w-0 shrink-0 items-center gap-2">{acciones}</div> : null}
    </header>
  );
}
