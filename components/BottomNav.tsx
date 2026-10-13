"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Droplets, Home, MoreHorizontal, PawPrint, Zap } from "lucide-react";
import { HojaAlGrano } from "@/components/HojaAlGrano";
import type { PlanId, RolFinca } from "@/lib/tipos";

const TABS = [
  { href: "/", etiqueta: "Hoy", Icono: Home },
  { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
  { href: "/leche", etiqueta: "Leche", Icono: Droplets },
  { href: "/mas", etiqueta: "Más", Icono: MoreHorizontal },
] as const;

/**
 * Barra inferior de 4 pestañas con un botón central de acción rápida (patrón Mobbin: Attio, ClickUp, Jobber).
 * Respeta el área segura del teléfono. Desde pantallas anchas (lg) se oculta: ahí manda el menú lateral (`NavLateral`).
 */
export function BottomNav({ rol, plan }: { rol: RolFinca; plan: PlanId }) {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);

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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-arena bg-papel/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-center px-2">
          {izquierda.map((t) => (
            <Tab key={t.href} {...t} />
          ))}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setAbierta(true)}
              aria-label="Al grano"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-ocre text-papel shadow-lg ring-4 ring-lana transition active:scale-95"
            >
              <Zap className="size-7" strokeWidth={2.2} />
            </button>
          </div>
          {derecha.map((t) => (
            <Tab key={t.href} {...t} />
          ))}
        </div>
      </nav>

      <HojaAlGrano abierta={abierta} onCerrar={() => setAbierta(false)} rol={rol} plan={plan} />
    </>
  );
}
