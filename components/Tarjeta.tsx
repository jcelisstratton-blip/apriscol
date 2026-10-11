export function Tarjeta({
  titulo,
  acciones,
  children,
  className = "",
}: {
  titulo?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-3xl bg-papel p-4 ring-1 ring-arena ${className}`}>
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
