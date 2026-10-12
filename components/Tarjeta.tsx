export function Tarjeta({
  titulo,
  acciones,
  children,
  className = "",
  id,
}: {
  titulo?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Para enlazar directo a la tarjeta (`/hato/…#premios`). */
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-4 min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena ${className}`}>
      {titulo ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">{titulo}</h2>
          {acciones}
        </div>
      ) : null}
      {children}
    </section>
  );
}
