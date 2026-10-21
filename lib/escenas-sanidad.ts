import { Footprints, LayoutDashboard, Pill, Scissors, Stethoscope, Syringe, Waves } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { TipoEvento } from "@/lib/tipos";

/** Cada tipo de tratamiento sanitario, con su escena. */
export const ESCENA_EVENTO: Record<TipoEvento, EscenaDef> = {
  vacunacion: ESC.sanidad,
  desparasitacion: ESC.desparasitacion,
  tratamiento: escena(Pill, "ocre", Stethoscope),
  podologia: escena(Footprints, "ambar", Scissors),
  pediluvio: escena(Waves, "oliva", Footprints),
  cirugia: escena(Scissors, "grafito", Stethoscope),
  otro: ESC.registro,
};
/** «Todos los tipos» en un filtro. */
export const ESCENA_TODOS_TIPOS: EscenaDef = escena(LayoutDashboard, "musgo", Syringe);
