"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Droplets, Home, KeyRound, LogOut, PawPrint, Plus, Settings, ShieldCheck, Trophy, Users } from "lucide-react";
import { FincaSelector } from "@/components/FincaSelector";
import { accionesRegistro, HojaRegistrar, type PermisosRegistro } from "@/components/HojaRegistrar";
import { Marca } from "@/components/Marca";
import { cerrarSesion } from "@/app/login/actions";
import type { RolFinca } from "@/lib/tipos";

type Enlace = { href: string; etiqueta: string; Icono: typeof Home };

/**
 * Menú lateral del computador (desde `lg`). En el celular manda la barra inferior (`BottomNav`).
 * Muestra solo lo que el rol de la persona puede ver.
 */
export function NavLateral({
  nombre,
  correo,
  fincas,
  fincaActiva,
  permisos,
  verLeche,
  verPremios,
  verEquipo,
  esSuperadmin,
}: {
  nombre: string;
  correo: string;
  fincas: { id: string; nombre: string; rol: RolFinca }[];
  fincaActiva: string;
  permisos: PermisosRegistro;
  verLeche: boolean;
  verPremios: boolean;
  verEquipo: boolean;
  esSuperadmin: boolean;
}) {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);
  const acciones = accionesRegistro(permisos);

  const enlaces: Enlace[] = [
    { href: "/", etiqueta: "Hoy", Icono: Home },
    { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
    ...(verLeche ? [{ href: "/leche", etiqueta: "Leche", Icono: Droplets }] : []),
    ...(verPremios ? [{ href: "/ferias", etiqueta: "Premios", Icono: Trophy }] : []),
    ...(verEquipo ? [{ href: "/mas/miembros", etiqueta: "Equipo", Icono: Users }] : []),
  ];

  // «Cuenta» (/mas) se marca solo en su propia página: «Equipo» también empieza por /mas.
  const activo = (href: string) => (href === "/" || href === "/mas" ? ruta === href : ruta.startsWith(href));
  const clase = (esActivo: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition ${
      esActivo ? "bg-musgo/12 text-musgo" : "text-humo hover:bg-arena/60 hover:text-tinta"
    }`;

  return (
    <>
      <aside aria-label="Menú principal" className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-arena bg-papel px-4 pb-5 pt-6 lg:flex">
        <Link href="/" aria-label="Apriscol, ir a Hoy" className="px-1">
          <Marca />
        </Link>

        <button
          type="button"
          onClick={() => setAbierta(true)}
          disabled={acciones.length === 0}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ocre px-4 text-[0.9375rem] font-semibold text-papel shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-40"
        >
          <Plus className="size-5" strokeWidth={2.4} /> Registrar
        </button>

        <nav aria-label="Principal" className="mt-5 space-y-1">
          {enlaces.map(({ href, etiqueta, Icono }) => (
            <Link key={href} href={href} aria-current={activo(href) ? "page" : undefined} className={clase(activo(href))}>
              <Icono className="size-5 shrink-0" strokeWidth={activo(href) ? 2.1 : 1.7} /> {etiqueta}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-arena pt-4">
          <FincaSelector fincas={fincas} activa={fincaActiva} />
          <div className="flex items-center gap-3 px-1">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-musgo font-display text-lg font-semibold text-sobre-musgo" aria-hidden="true">
              {nombre.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{nombre}</span>
              <span className="block truncate text-xs text-humo">{correo}</span>
            </span>
          </div>
          <div className="space-y-1">
            {esSuperadmin ? (
              <Link href="/admin" className={clase(false)}>
                <ShieldCheck className="size-5 shrink-0 text-ocre" strokeWidth={1.7} /> Panel superadmin
              </Link>
            ) : null}
            <Link href="/mas" aria-current={activo("/mas") ? "page" : undefined} className={clase(activo("/mas"))}>
              <Settings className="size-5 shrink-0" strokeWidth={1.7} /> Cuenta y ajustes
            </Link>
            <Link href="/cambiar-clave" className={clase(false)}>
              <KeyRound className="size-5 shrink-0" strokeWidth={1.7} /> Cambiar contraseña
            </Link>
            <form action={cerrarSesion}>
              <button type="submit" className={`${clase(false)} w-full text-left hover:text-rojo`}>
                <LogOut className="size-5 shrink-0" strokeWidth={1.7} /> Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </aside>

      <HojaRegistrar abierta={abierta} onCerrar={() => setAbierta(false)} acciones={acciones} />
    </>
  );
}
