"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Baby, Beef, Droplets, Fence, FileBarChart2, GitFork, Home, KeyRound, LogOut, MapPin, PawPrint, Rocket, Settings, ShieldCheck, SlidersHorizontal, Syringe, TrendingUp, Trophy, Users, Wallet, Zap } from "lucide-react";
import { FincaSelector } from "@/components/FincaSelector";
import { HojaAlGrano } from "@/components/HojaAlGrano";
import { Marca } from "@/components/Marca";
import { cerrarSesion } from "@/app/login/actions";
import { entradaMarcada } from "@/lib/nav";
import type { PlanId, RolFinca } from "@/lib/tipos";

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
  rol,
  plan,
  verLeche,
  verPremios,
  verSanidad,
  verCorrales,
  verCostos,
  verCarne,
  verRepro,
  verReportes,
  verProyecciones,
  verEquipo,
  verPlan,
  planMejorable,
  esSuperadmin,
}: {
  nombre: string;
  correo: string;
  fincas: { id: string; nombre: string; rol: RolFinca; logo_path?: string | null }[];
  fincaActiva: string;
  rol: RolFinca;
  plan: PlanId;
  verLeche: boolean;
  verPremios: boolean;
  verSanidad: boolean;
  verCorrales: boolean;
  verCostos: boolean;
  verCarne: boolean;
  verRepro: boolean;
  /** Hay al menos un reporte que la persona puede abrir. */
  verReportes: boolean;
  /** Propietario o administrador con el plan que incluye Proyecciones. */
  verProyecciones: boolean;
  verEquipo: boolean;
  /** El propietario ve su plan en el menú principal. */
  verPlan: boolean;
  /** Hay un plan superior al actual: la entrada dice «Cambiar el plan»; si no, «Plan de esta finca». */
  planMejorable: boolean;
  esSuperadmin: boolean;
}) {
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);

  const enlaces: Enlace[] = [
    { href: "/", etiqueta: "Hoy", Icono: Home },
    { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
    ...(verLeche ? [{ href: "/leche", etiqueta: "Leche", Icono: Droplets }] : []),
    ...(verRepro ? [{ href: "/reproduccion", etiqueta: "Reproducción", Icono: Baby }] : []),
    ...(verCarne ? [{ href: "/carne", etiqueta: "Carne", Icono: Beef }] : []),
    ...(verSanidad ? [{ href: "/sanidad", etiqueta: "Sanidad", Icono: Syringe }] : []),
    ...(verCorrales ? [{ href: "/corrales", etiqueta: "Corrales", Icono: Fence }] : []),
    ...(verCostos ? [{ href: "/costos", etiqueta: "Costos", Icono: Wallet }] : []),
    ...(verReportes ? [{ href: "/reportes", etiqueta: "Reportes", Icono: FileBarChart2 }] : []),
    ...(verProyecciones ? [{ href: "/proyecciones", etiqueta: "Proyecciones", Icono: TrendingUp }] : []),
    // Lo que mira o hace sobre todo el hato va aquí; lo que es de un solo animal vive en su ficha.
    { href: "/hato/endogamia", etiqueta: "Endogamia", Icono: GitFork },
    ...(verPremios ? [{ href: "/ferias", etiqueta: "Premios", Icono: Trophy }] : []),
    ...(verEquipo ? [{ href: "/mas/miembros", etiqueta: "Equipo", Icono: Users }] : []),
    ...(verPlan ? [{ href: "/mas/plan", etiqueta: planMejorable ? "Cambiar el plan" : "Plan de esta finca", Icono: Rocket }] : []),
  ];

  const marcada = entradaMarcada(ruta, [...enlaces.map((e) => e.href), ...(verEquipo ? ["/mas/finca"] : []), "/mas/ajustes", "/mas"]);
  const activo = (href: string) => href === marcada;
  const clase = (esActivo: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition ${
      esActivo ? "bg-musgo/12 text-musgo" : "text-humo hover:bg-arena/60 hover:text-tinta"
    }`;

  return (
    <>
      <aside aria-label="Menú principal" className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-arena bg-papel px-4 pb-4 pt-5 lg:flex">
        <Link href="/" aria-label="Apriscol, ir a Hoy" className="px-1">
          <Marca />
        </Link>

        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ocre px-4 text-[0.9375rem] font-semibold text-papel shadow-sm transition hover:brightness-95 active:scale-[0.98]"
        >
          <Zap className="size-5" strokeWidth={2.2} /> Al grano
        </button>

        <nav aria-label="Principal" className="mt-4 space-y-1">
          {enlaces.map(({ href, etiqueta, Icono }) => (
            <Link key={href} href={href} aria-current={activo(href) ? "page" : undefined} className={clase(activo(href))}>
              <Icono className="size-5 shrink-0" strokeWidth={activo(href) ? 2.1 : 1.7} /> {etiqueta}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-arena pt-3">
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
            {verEquipo ? (
              <Link href="/mas/finca" aria-current={activo("/mas/finca") ? "page" : undefined} className={clase(activo("/mas/finca"))}>
                <MapPin className="size-5 shrink-0" strokeWidth={1.7} /> Datos de la finca
              </Link>
            ) : null}
            <Link href="/mas/ajustes" aria-current={activo("/mas/ajustes") ? "page" : undefined} className={clase(activo("/mas/ajustes"))}>
              <SlidersHorizontal className="size-5 shrink-0" strokeWidth={1.7} /> Ajustes de la finca
            </Link>
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

      <HojaAlGrano abierta={abierta} onCerrar={() => setAbierta(false)} rol={rol} plan={plan} />
    </>
  );
}
