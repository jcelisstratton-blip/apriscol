import { Activity, ArchiveX, ArrowRightLeft, Baby, Banknote, Beef, Calendar, ClipboardList, Cloud, Crown, Droplets, Fence, FlaskConical, Heart, HeartHandshake, Layers, LayoutDashboard, ListChecks, LogOut, Mars, Microscope, Milk, Mountain, Package, PawPrint, Pill, Scale, ShieldPlus, SlidersHorizontal, Snowflake, Sprout, Syringe, TrendingUp, Trophy, Truck, Venus, Wallet, Receipt, Warehouse, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** El color de una tarjeta de opción. Salen de la paleta de la app (musgo, ocre, arcilla…) y se adaptan solos al modo oscuro. */
export type Tono = "musgo" | "ocre" | "arcilla" | "oliva" | "ambar" | "grafito";

/** Cómo se dibuja la «escena» de una tarjeta: un icono grande que hace referencia a su contenido, uno pequeño de acompañamiento y el color. */
export type EscenaDef = { icono: LucideIcon; extra?: LucideIcon; tono: Tono };

export const escena = (icono: LucideIcon, tono: Tono, extra?: LucideIcon): EscenaDef => ({ icono, tono, extra });

/** Los filtros de la lista de animales y las vistas de trabajo del Hato. */
export const ESCENA_HATO: Record<string, EscenaDef> = {
  todos: escena(PawPrint, "musgo", Sprout),
  hembras: escena(Venus, "ocre", Milk),
  machos: escena(Mars, "grafito", Crown),
  caprino: escena(Mountain, "oliva", Sprout),
  ovino: escena(Cloud, "ambar", Wheat),
  bajas: escena(ArchiveX, "grafito", LogOut),
  ordeno: escena(Milk, "oliva", Droplets),
  ceba: escena(Beef, "arcilla", Scale),
  empadronamiento: escena(Heart, "arcilla", Calendar),
  sanidad: escena(Syringe, "musgo", ShieldPlus),
  corrales: escena(Fence, "ocre", Warehouse),
  gastos: escena(Wallet, "ambar", Receipt),
  ventas: escena(Banknote, "oliva", TrendingUp),
};

/** Las pestañas de cada módulo del menú. */
export const ESCENA_PESTANA: Record<string, EscenaDef> = {
  resumen: escena(LayoutDashboard, "musgo", Activity),
  historial: escena(ClipboardList, "ocre"),
  productos: escena(Package, "ocre", Pill),
  pruebas: escena(FlaskConical, "arcilla", Microscope),
  movimientos: escena(ArrowRightLeft, "ocre", Fence),
  produccion: escena(Milk, "oliva", Droplets),
  calidad: escena(FlaskConical, "arcilla", Microscope),
  despachos: escena(Truck, "ocre", Package),
  frio: escena(Snowflake, "musgo", Milk),
  candidatos: escena(ListChecks, "musgo", Beef),
  lotes: escena(Layers, "ocre", Beef),
  pesajes: escena(Scale, "ambar", Beef),
  canales: escena(Beef, "arcilla", Scale),
  salidas: escena(LogOut, "grafito", Truck),
  reglas: escena(SlidersHorizontal, "grafito", ListChecks),
  premios: escena(Trophy, "ambar", Crown),
  ferias: escena(Calendar, "ocre", Trophy),
  empadronamiento: escena(Heart, "arcilla", Calendar),
  servicios: escena(HeartHandshake, "arcilla", Heart),
  partos: escena(Baby, "ocre", Heart),
};

export type PestanaTarjeta = { valor: string; etiqueta: string; href: string; escena: EscenaDef; detalle?: string; dato?: string };

/** Arma las pestañas de un módulo: la primera va a la ruta sola y las demás a `?vista=`; la escena sale de `ESCENA_PESTANA`. */
export function armarPestanas(ruta: string, primera: string, lista: readonly { valor: string; etiqueta: string; detalle?: string }[]): PestanaTarjeta[] {
  return lista.map((p) => ({ ...p, href: p.valor === primera ? ruta : `${ruta}?vista=${p.valor}`, escena: ESCENA_PESTANA[p.valor] }));
}

/** Las tres formas de trabajar el ordeño (Hato → Ordeño). */
export const ESCENA_ORDENO: Record<string, EscenaDef> = {
  registrar: escena(Milk, "oliva", Droplets),
  programar: escena(Calendar, "ocre", Milk),
  calidad: escena(FlaskConical, "arcilla", Microscope),
};
