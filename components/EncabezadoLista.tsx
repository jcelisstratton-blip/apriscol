/** Título de un grupo dentro de una lista de opciones (por ejemplo «Cabras» y «Cabros»). Solo se muestra si hay más de un grupo. */
export function EncabezadoLista({ titulo }: { titulo: string }) {
  return (
    <li role="presentation" className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-humo first:pt-1">
      {titulo}
    </li>
  );
}
