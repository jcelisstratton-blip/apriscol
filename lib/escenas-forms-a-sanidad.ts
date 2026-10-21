import { Activity, Baby, Bandage, Beaker, Bone, CircleHelp, CircleCheck, Droplet, Droplets, Dumbbell, Flame, FlaskConical, GlassWater, Hand, HeartPulse, Hourglass, Layers, Leaf, Microscope, Milk, Pill, ShieldAlert, ShieldPlus, Sparkles, Syringe, TestTube, Thermometer, TriangleAlert } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { ResultadoPrueba, TipoProducto, TipoPrueba, ViaAplicacion } from "@/lib/tipos";

/** Por dónde se aplica un tratamiento. */
export const ESCENA_VIA: Record<ViaAplicacion, EscenaDef> = {
  oral: escena(Pill, "ocre", GlassWater),
  subcutanea: escena(Syringe, "oliva", Layers),
  intramuscular: escena(Dumbbell, "arcilla", Syringe),
  intravenosa: escena(Droplets, "musgo", HeartPulse),
  topica: escena(Hand, "ambar", Droplet),
  intramamaria: escena(Milk, "ocre", Syringe),
  otra: ESC.registro,
};

/** Cada tipo de producto del catálogo veterinario. */
export const ESCENA_TIPO_PRODUCTO: Record<TipoProducto, EscenaDef> = {
  vacuna: ESC.sanidad,
  desparasitante: ESC.desparasitacion,
  antibiotico: escena(Pill, "ocre", Microscope),
  antiinflamatorio: escena(Flame, "ambar", Thermometer),
  vitamina: escena(Leaf, "oliva", Sparkles),
  otro: ESC.producto,
};

/** Cada prueba diagnóstica. */
export const ESCENA_TIPO_PRUEBA: Record<TipoPrueba, EscenaDef> = {
  cae: escena(Bone, "ocre", TestTube),
  brucelosis: escena(Baby, "arcilla", TestTube),
  cmt: escena(Milk, "oliva", Beaker),
  mastitis_cultivo: escena(FlaskConical, "ambar", Microscope),
  paratuberculosis: escena(Activity, "musgo", Microscope),
  otra: escena(Microscope, "grafito"),
};

/** El resultado de una prueba: negativo es bueno (verde), positivo alerta (rojo). */
export const ESCENA_RESULTADO_PRUEBA: Record<ResultadoPrueba, EscenaDef> = {
  negativo: escena(CircleCheck, "oliva", ShieldPlus),
  positivo: escena(ShieldAlert, "arcilla", TestTube),
  sospechoso: escena(CircleHelp, "ambar", TriangleAlert),
  pendiente: escena(Hourglass, "grafito", Bandage),
};
