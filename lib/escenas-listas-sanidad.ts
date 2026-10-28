import { Bug, Carrot, CircleHelp, Eye, Flame, FlaskConical, Hourglass, LayoutDashboard, Microscope, Package, Pill, ShieldAlert, ShieldCheck, TestTube } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { Novedad, ResultadoPrueba, TipoProducto } from "@/lib/tipos";

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

/** Cada nivel de carga de un examen coprológico, con su escena. */
export const ESCENA_NIVEL_COPROLOGICO: Record<"bajo" | "moderado" | "alto" | "muy_alto", EscenaDef> = {
  bajo: escena(ShieldCheck, "oliva", Microscope),
  moderado: escena(CircleHelp, "ocre", Microscope),
  alto: escena(ShieldAlert, "ambar", Microscope),
  muy_alto: escena(ShieldAlert, "arcilla", TestTube),
};
/** «Todos» en el filtro de exámenes coprológicos. */
export const ESCENA_TODOS_COPROLOGICOS: EscenaDef = escena(LayoutDashboard, "musgo", Microscope);

/** Cómo se recogió la muestra del coprológico: directo del animal o del piso. */
export const ESCENA_MUESTRA: Record<"limpia" | "contaminada", EscenaDef> = {
  limpia: escena(ShieldCheck, "oliva", Microscope),
  contaminada: escena(ShieldAlert, "arcilla", TestTube),
};

/** Lo que se puede contar en una novedad: los mismos botones de la ficha en Sanidad. */
export const ESCENA_TIPO_NOVEDAD: Record<Novedad["tipo"], EscenaDef> = {
  aplicacion: ESC.sanidad,
  prueba: ESC.laboratorio,
  coprologico: escena(Microscope, "oliva", Bug),
  famacha: escena(Eye, "ocre", Pill),
};
