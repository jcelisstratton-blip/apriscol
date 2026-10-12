import { Bug, ClipboardList, Footprints, LayoutDashboard, Pill, Scissors, ShieldPlus, Stethoscope, Syringe, Waves } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { TipoEvento } from "@/lib/tipos";

/** Cada tipo de tratamiento sanitario, con su escena. */
export const ESCENA_EVENTO: Record<TipoEvento, EscenaDef> = {
  vacunacion: escena(Syringe, "musgo", ShieldPlus),
  desparasitacion: escena(Bug, "arcilla", Pill),
  tratamiento: escena(Pill, "ocre", Stethoscope),
  podologia: escena(Footprints, "ambar", Scissors),
  pediluvio: escena(Waves, "oliva", Footprints),
  cirugia: escena(Scissors, "grafito", Stethoscope),
  otro: escena(ClipboardList, "grafito"),
};
/** «Todos los tipos» en un filtro. */
export const ESCENA_TODOS_TIPOS: EscenaDef = escena(LayoutDashboard, "musgo", Syringe);
