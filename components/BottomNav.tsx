"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Droplets, Home, MoreHorizontal, PawPrint, Plus, Rabbit } from "lucide-react";
import { Sheet } from "@/components/Sheet";

type Accion = { href: string; titulo: string; detalle: string; icono: React.ReactNode };

const TABS = [
  { href: "/", etiqueta: "Hoy", Icono: Home },
  { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
  { href: "/leche", etiqueta: "Leche", Icono: Droplets },
  { href: "/mas", etiqueta: "Más", Icono: MoreHorizontal },
] as const;

/**
 * Barra inferior de 4 pestañas con un botón central de acción rápida (patrón Mobbin: Attio, ClickUp, Jobber).
 * Respeta el área segura del teléfono.
 */
export function BottomNav({ puedeOrdenar, puedeCrearAnimal }: { puedeOrdenar: boolean; puedeCrearAnimal: boolean }) {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);

  const acciones: Accion[] = [
    ...(puedeOrdenar
      ? [{ href: "/leche", titulo: "Registrar ordeño", detalle: "Litros por animal, jornada de hoy", icono: <Droplets className="size-6" strokeWidth={1.75} /> }]
      : []),
    ...(puedeCrearAnimal
      ? [{ href: "/hato/nuevo", titulo: "Animal nuevo", detalle: "Cabra, cabro, oveja o carnero", icono: <Rabbit className="size-6" strokeWidth={1.75} /> }]
      : []),
  ];

  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));
  const izquierda = TABS.slice(0, 2);
  const derecha = TABS.slice(2);

  const Tab = ({ href, etiqueta, Icono }: (typeof TABS)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={activo(href) ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold ${
        activo(href) ? "text-musgo" : "text-humo"
      }`}
    >
      <Icono className="size-6" strokeWidth={activo(href) ? 2.1 : 1.6} />
      {etiqueta}
    </Link>
  );

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-arena bg-papel/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-md items-center px-2">
          {izquierda.map((t) => (
            <Tab key={t.href} {...t} />
          ))}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setAbierta(true)}
              disabled={acciones.length === 0}
              aria-label="Registrar"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-ocre text-papel shadow-lg ring-4 ring-lana transition active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-7" strokeWidth={2.4} />
            </button>
          </div>
          {derecha.map((t) => (
            <Tab key={t.href} {...t} />
          ))}
        </div>
      </nav>

      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Qué vas a registrar?">
        <ul className="space-y-2">
          {acciones.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                onClick={() => setAbierta(false)}
                className="flex min-h-16 items-center gap-4 rounded-2xl bg-lana px-4 hover:bg-arena/70"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-musgo/12 text-musgo">{a.icono}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{a.titulo}</span>
                  <span className="block text-sm text-humo">{a.detalle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
