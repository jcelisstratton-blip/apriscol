import { urlLogo } from "@/lib/logo-finca";

/** El logo de la finca (circular, completo, sin recortar) o, si no tiene, su inicial. Sirve en servidor y en cliente. */
export function LogoFinca({ finca, className = "size-10" }: { finca: { id: string; nombre: string; logo_path?: string | null }; className?: string }) {
  const url = urlLogo({ id: finca.id, logo_path: finca.logo_path ?? null });
  return url ? (
    // Dirección propia con sesión y caché de un año (ver /api/logo): no pasa por el optimizador de imágenes.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className={`${className} shrink-0 rounded-full bg-papel object-contain ring-1 ring-arena`} />
  ) : (
    <span className={`${className} grid shrink-0 place-items-center rounded-full bg-arena font-display font-semibold text-musgo-osc`} aria-hidden="true">
      {finca.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}
