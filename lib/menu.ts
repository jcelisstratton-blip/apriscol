import { Baby, Beef, Download, Droplets, Fence, FileBarChart2, Gift, GitFork, Home, MapPin, Package, PawPrint, Plus, Rocket, SlidersHorizontal, Syringe, TrendingUp, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { puedeGestionar, puedeVer } from "@/lib/permisos";
import { reportesVisibles } from "@/lib/reportes/catalogo";
import type { PlanId, RolFinca } from "@/lib/tipos";

/**
 * El menú de la app, definido una sola vez: lo dibujan el menú lateral del computador (`NavLateral`) y la lista de «Más» del celular
 * (`app/(app)/mas/page.tsx`), así que nunca pueden quedar distintos. Una entrada nueva se agrega aquí, en el grupo que le toca.
 */

export type EntradaMenu = { href: string; etiqueta: string; Icono: LucideIcon; /** Se pinta en ocre (lo que es del plan o de crecer, no del trabajo diario). */ acento?: boolean };
export type GrupoMenu = { id: string; titulo?: string; entradas: EntradaMenu[] };

/** Qué ve la persona: sale de su rol y del plan de la finca. */
export type VisibilidadMenu = {
  leche: boolean;
  repro: boolean;
  carne: boolean;
  sanidad: boolean;
  corrales: boolean;
  costos: boolean;
  reportes: boolean;
  proyecciones: boolean;
  premios: boolean;
  /** Datos de la finca y Equipo. */
  equipo: boolean;
  propietario: boolean;
  /** Hay un plan superior al actual: la entrada dice «Cambiar el plan»; si no, «Plan de esta finca». */
  planMejorable: boolean;
};

export function visibilidadMenu(rol: RolFinca, plan: PlanId): VisibilidadMenu {
  const ve = (m: Parameters<typeof puedeVer>[1]) => puedeVer(rol, m, plan);
  return {
    leche: ve("leche"),
    repro: ve("reproduccion"),
    carne: ve("carne"),
    sanidad: ve("sanidad"),
    corrales: ve("corrales"),
    costos: ve("contabilidad"),
    reportes: reportesVisibles(ve).length > 0 || ve("contabilidad"),
    proyecciones: puedeGestionar(rol) && ve("proyecciones"),
    premios: ve("ferias"),
    equipo: puedeGestionar(rol) || ve("contabilidad"),
    propietario: rol === "propietario",
    planMejorable: plan !== "hacienda",
  };
}

/** Hoy y Hato (sin título) y los grupos de trabajo. Un grupo sin entradas para esa persona no aparece. */
export function menuPrincipal(v: VisibilidadMenu): GrupoMenu[] {
  const grupos: GrupoMenu[] = [
    {
      id: "inicio",
      entradas: [
        { href: "/", etiqueta: "Hoy", Icono: Home },
        { href: "/hato", etiqueta: "Hato", Icono: PawPrint },
      ],
    },
    {
      id: "produccion",
      titulo: "Producción y manejo",
      entradas: [
        ...(v.leche ? [{ href: "/leche", etiqueta: "Leche", Icono: Droplets }] : []),
        ...(v.repro ? [{ href: "/reproduccion", etiqueta: "Reproducción", Icono: Baby }] : []),
        ...(v.carne ? [{ href: "/carne", etiqueta: "Carne", Icono: Beef }] : []),
        ...(v.sanidad ? [{ href: "/sanidad", etiqueta: "Sanidad", Icono: Syringe }] : []),
        ...(v.corrales ? [{ href: "/corrales", etiqueta: "Corrales", Icono: Fence }] : []),
      ],
    },
    {
      id: "dinero",
      titulo: "Dinero y análisis",
      entradas: [
        ...(v.costos ? [{ href: "/costos", etiqueta: "Costos", Icono: Wallet }] : []),
        ...(v.reportes ? [{ href: "/reportes", etiqueta: "Reportes", Icono: FileBarChart2 }] : []),
        ...(v.proyecciones ? [{ href: "/proyecciones", etiqueta: "Proyecciones", Icono: TrendingUp }] : []),
        ...(v.costos ? [{ href: "/mas/productos", etiqueta: "Productos y terceros", Icono: Package }] : []),
      ],
    },
    {
      // Lo que mira o hace sobre todo el hato va aquí; lo que es de un solo animal vive en su ficha.
      id: "genealogia",
      titulo: "Genealogía",
      entradas: [
        { href: "/hato/endogamia", etiqueta: "Endogamia", Icono: GitFork },
        ...(v.premios ? [{ href: "/ferias", etiqueta: "Premios", Icono: Trophy }] : []),
      ],
    },
  ];
  return grupos.filter((g) => g.entradas.length > 0);
}

/** Lo de la finca: sus datos, ajustes, equipo, plan y lo que se hace con ella. */
export function menuFinca(v: VisibilidadMenu): EntradaMenu[] {
  return [
    ...(v.equipo ? [{ href: "/mas/finca", etiqueta: "Datos de la finca", Icono: MapPin }] : []),
    { href: "/mas/ajustes", etiqueta: "Ajustes de la finca", Icono: SlidersHorizontal },
    ...(v.equipo ? [{ href: "/mas/miembros", etiqueta: "Equipo", Icono: Users }] : []),
    { href: "/mas/referidos", etiqueta: "Referidos", Icono: Gift, acento: true },
    ...(v.propietario ? [{ href: "/mas/plan", etiqueta: v.planMejorable ? "Cambiar el plan" : "Plan de esta finca", Icono: Rocket, acento: true }] : []),
    ...(v.propietario ? [{ href: "/mas/exportar", etiqueta: "Exportar datos", Icono: Download }] : []),
    { href: "/onboarding", etiqueta: "Agregar otra finca", Icono: Plus },
  ];
}

/** Todos los destinos del menú, para marcar la entrada más específica de la ruta actual. */
export const destinosMenu = (v: VisibilidadMenu): string[] => [...menuPrincipal(v).flatMap((g) => g.entradas), ...menuFinca(v)].map((e) => e.href).concat("/mas");
