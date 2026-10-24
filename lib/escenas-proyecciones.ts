import { Beef, Coins, Columns3, Droplets, LayoutDashboard, Milk, PawPrint, ShieldAlert, SlidersHorizontal, Sprout, Tag, TrendingDown, Wheat } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { Enfoque } from "@/lib/proyeccion/vista";

/** Las pestañas de Proyecciones y las tarjetas de «qué quieres ver». */
export const ESCENA_PESTANA_PROYECCION: Record<string, EscenaDef> = {
  resumen: escena(LayoutDashboard, "musgo", Sprout),
  hato: escena(PawPrint, "ambar", Tag),
  alimento: escena(Wheat, "ocre", Sprout),
  dinero: escena(Coins, "oliva", Tag),
  comparar: escena(Columns3, "arcilla", Tag),
  riesgos: escena(ShieldAlert, "ocre", TrendingDown),
  supuestos: escena(SlidersHorizontal, "grafito", Coins),
};

export const ESCENA_ENFOQUE: Record<Enfoque, EscenaDef> = {
  todo: escena(LayoutDashboard, "musgo", Coins),
  carne: escena(Beef, "arcilla", Tag),
  leche: escena(Milk, "oliva", Droplets),
};
