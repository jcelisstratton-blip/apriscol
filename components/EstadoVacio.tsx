export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-arena text-musgo [&>svg]:size-7">{icono}</div>
      <h2 className="font-display text-xl font-semibold">{titulo}</h2>
      {descripcion ? <p className="max-w-xs text-[0.9375rem] text-humo">{descripcion}</p> : null}
      {children ? <div className="mt-2 w-full max-w-xs">{children}</div> : null}
    </div>
  );
}
