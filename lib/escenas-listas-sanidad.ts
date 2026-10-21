import { Carrot, CircleHelp, Flame, FlaskConical, Hourglass, LayoutDashboard, Microscope, Package, Pill, ShieldAlert, ShieldCheck, TestTube } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { ResultadoPrueba, TipoProducto } from "@/lib/tipos";

/** Cada tipo de producto veterinario del catálogo, con su escena. */
export const ESCENA_PRODUCTO: Record<TipoProducto, EscenaDef> = {
  vacuna: ESC.sanidad,
  desparasitante: ESC.desparasitacion,
  antibiotico: escena(Pill, "ocre", FlaskConical),
  antiinflamatorio: escena(Flame, "ambar", Pill),
  vitamina: escena(Carrot, "oliva", Pill),
  otro: ESC.producto,
};
/** «Todos» en el filtro del catálogo de productos. */
export const ESCENA_TODOS_PRODUCTOS: EscenaDef = escena(LayoutDashboard, "musgo", Package);

/** Cada resultado de una prueba diagnóstica, con su escena. */
export const ESCENA_RESULTADO_PRUEBA: Record<ResultadoPrueba, EscenaDef> = {
  negativo: escena(ShieldCheck, "oliva", Microscope),
  positivo: escena(ShieldAlert, "arcilla", Microscope),
  sospechoso: escena(CircleHelp, "ambar", TestTube),
  pendiente: escena(Hourglass, "grafito", TestTube),
};
/** «Todas» en el filtro de pruebas. */
export const ESCENA_TODAS_PRUEBAS: EscenaDef = escena(LayoutDashboard, "musgo", FlaskConical);
