import Link from "next/link";

/** Un chip que es un enlace (para cambiar de pantalla sin estado de cliente). Se ve igual que `Chip`. */
export function ChipEnlace({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
        activo ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
      }`}
    >
      {children}
    </Link>
  );
}
