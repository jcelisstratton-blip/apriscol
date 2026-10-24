"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Baby, Beef, Droplets, Fence, FileBarChart2, GitFork, Home, MapPin, PawPrint, Rocket, SlidersHorizontal, Syringe, TrendingUp, Trophy, Users, Wallet, Zap } from "lucide-react";
import { FincaSelector } from "@/components/FincaSelector";
import { HojaAlGrano } from "@/components/HojaAlGrano";
import { Marca } from "@/components/Marca";
import { MenuUsuario } from "@/components/MenuUsuario";
import { entradaMarcada } from "@/lib/nav";
import type { PlanId, RolFinca } from "@/lib/tipos";

type Enlace = { href: string; etiqueta: string; Icono: typeof Home };
type Grupo = { titulo?: string; enlaces: Enlace[] };

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

  // El trabajo de cada día arriba, agrupado por tipo de cosa; lo de la finca (datos, ajustes, equipo, plan) abajo, aparte. Un grupo sin entradas no se muestra.
  const grupos: Grupo[] = [
    {
      enlaces: [
        { href: "/", etiqueta: "Hoy", Icono: Home },
        { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
      ],
    },
    {
      titulo: "Producción y manejo",
      enlaces: [
        ...(verLeche ? [{ href: "/leche", etiqueta: "Leche", Icono: Droplets }] : []),
        ...(verRepro ? [{ href: "/reproduccion", etiqueta: "Reproducción", Icono: Baby }] : []),
        ...(verCarne ? [{ href: "/carne", etiqueta: "Carne", Icono: Beef }] : []),
        ...(verSanidad ? [{ href: "/sanidad", etiqueta: "Sanidad", Icono: Syringe }] : []),
        ...(verCorrales ? [{ href: "/corrales", etiqueta: "Corrales", Icono: Fence }] : []),
      ],
    },
    {
      titulo: "Dinero y análisis",
      enlaces: [
        ...(verCostos ? [{ href: "/costos", etiqueta: "Costos", Icono: Wallet }] : []),
        ...(verReportes ? [{ href: "/reportes", etiqueta: "Reportes", Icono: FileBarChart2 }] : []),
        ...(verProyecciones ? [{ href: "/proyecciones", etiqueta: "Proyecciones", Icono: TrendingUp }] : []),
      ],
    },
    {
      // Lo que mira o hace sobre todo el hato va aquí; lo que es de un solo animal vive en su ficha.
      titulo: "Genealogía",
      enlaces: [
        { href: "/hato/endogamia", etiqueta: "Endogamia", Icono: GitFork },
        ...(verPremios ? [{ href: "/ferias", etiqueta: "Premios", Icono: Trophy }] : []),
      ],
    },
  ].filter((g) => g.enlaces.length > 0);

  const miFinca: Enlace[] = [
    ...(verEquipo ? [{ href: "/mas/finca", etiqueta: "Datos de la finca", Icono: MapPin }] : []),
    { href: "/mas/ajustes", etiqueta: "Ajustes de la finca", Icono: SlidersHorizontal },
    ...(verEquipo ? [{ href: "/mas/miembros", etiqueta: "Equipo", Icono: Users }] : []),
    ...(verPlan ? [{ href: "/mas/plan", etiqueta: planMejorable ? "Cambiar el plan" : "Plan de esta finca", Icono: Rocket }] : []),
  ];

  const marcada = entradaMarcada(ruta, [...grupos.flatMap((g) => g.enlaces), ...miFinca].map((e) => e.href).concat("/mas"));
  const activo = (href: string) => href === marcada;
  const clase = (esActivo: boolean) =>
    `flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition ${
      esActivo ? "bg-musgo/12 text-musgo" : "text-humo hover:bg-arena/60 hover:text-tinta"
    }`;
  const TITULO_GRUPO = "px-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.09em] text-humo/75";
  const fila = ({ href, etiqueta, Icono }: Enlace) => (
    <Link key={href} href={href} aria-current={activo(href) ? "page" : undefined} className={clase(activo(href))}>
      <Icono className="size-5 shrink-0" strokeWidth={activo(href) ? 2.1 : 1.7} /> {etiqueta}
    </Link>
  );

  return (
    <>
      <aside aria-label="Menú principal" className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-arena bg-papel lg:flex">
        {/* Arriba, fijo: la marca y «Al grano» */}
        <div className="shrink-0 px-4 pt-5">
          <Link href="/" aria-label="Apriscol, ir a Hoy" className="block px-1">
            <Marca />
          </Link>
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ocre px-4 text-[0.9375rem] font-semibold text-papel shadow-sm transition hover:brightness-95 active:scale-[0.98]"
          >
            <Zap className="size-5" strokeWidth={2.2} /> Al grano
          </button>
        </div>

        {/* En el centro, lo único que se desplaza: el trabajo por grupos y, al final, lo de la finca (con espacio de sobra se queda pegado abajo) */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 [scrollbar-width:thin]">
          <nav aria-label="Principal">
            {grupos.map((g, n) => (
              <div key={g.titulo ?? "inicio"} role="group" aria-label={g.titulo} className={n === 0 ? "space-y-0.5" : "mt-4 space-y-0.5"}>
                {g.titulo ? <p className={TITULO_GRUPO} aria-hidden="true">{g.titulo}</p> : null}
                {g.enlaces.map(fila)}
              </div>
            ))}
          </nav>
          <nav aria-label="Mi finca" className="mt-auto space-y-0.5 border-t border-arena pt-3">
            <p className={`${TITULO_GRUPO} pt-1`} aria-hidden="true">Mi finca</p>
            {miFinca.map(fila)}
          </nav>
        </div>

        {/* Abajo, fijo: la finca activa y la persona */}
        <div className="shrink-0 space-y-2 border-t border-arena px-4 pb-4 pt-3">
          <FincaSelector fincas={fincas} activa={fincaActiva} />
          <MenuUsuario nombre={nombre} correo={correo} esSuperadmin={esSuperadmin} enMas={activo("/mas")} />
        </div>
      </aside>

      <HojaAlGrano abierta={abierta} onCerrar={() => setAbierta(false)} rol={rol} plan={plan} />
    </>
  );
}
