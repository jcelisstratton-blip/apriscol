"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilaDesplazable } from "@/components/FilaDesplazable";

const SECCIONES = [
  { href: "/admin", etiqueta: "Resumen" },
  { href: "/admin/fincas", etiqueta: "Fincas" },
  { href: "/admin/importaciones", etiqueta: "Importaciones" },
] as const;

/** Pestañas del espacio del superadmin. «Mi finca» solo aparece si además tiene una finca propia. */
export function NavAdmin({ conFincas }: { conFincas: boolean }) {
  const ruta = usePathname();
  const activa = (href: string) => (href === "/admin" ? ruta === "/admin" : ruta.startsWith(href));
  const clase = (activo: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
      activo ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
    }`;
  return (
    <FilaDesplazable>
      {SECCIONES.map((s) => (
        <Link key={s.href} href={s.href} aria-current={activa(s.href) ? "page" : undefined} className={clase(activa(s.href))}>
          {s.etiqueta}
        </Link>
      ))}
      {conFincas ? (
        <Link href="/" className={clase(false)}>
          Mi finca
        </Link>
      ) : null}
    </FilaDesplazable>
  );
}
