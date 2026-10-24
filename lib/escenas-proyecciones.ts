import { Beef, Coins, Droplets, LayoutDashboard, Milk, PawPrint, SlidersHorizontal, Sprout, Tag, Wheat } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { Enfoque } from "@/lib/proyeccion/vista";

/** Las pestañas de Proyecciones y las tarjetas de «qué quieres ver». */
export const ESCENA_PESTANA_PROYECCION: Record<string, EscenaDef> = {
  resumen: escena(LayoutDashboard, "musgo", Sprout),
  hato: escena(PawPrint, "ambar", Tag),
  alimento: escena(Wheat, "ocre", Sprout),
  dinero: escena(Coins, "oliva", Tag),
  supuestos: escena(SlidersHorizontal, "grafito", Coins),
};

export const ESCENA_ENFOQUE: Record<Enfoque, EscenaDef> = {
  todo: escena(LayoutDashboard, "musgo", Coins),
  carne: escena(Beef, "arcilla", Tag),
  leche: escena(Milk, "oliva", Droplets),
};
