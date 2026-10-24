import { BadgeCheck, Calculator, CircleOff, ClipboardList, Cog, Dna, GraduationCap, Hammer, Hand, Milk, PawPrint, Scissors, ShieldPlus, Sprout, Sun, Sunrise, Sunset, Syringe, TreePine, Wheat, Wrench, ArrowLeftRight } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { Especialidad, Formacion, Labor, TipoContador, TipoOrdeno, Turno } from "@/lib/perfil-personal";

export const ESCENA_ESPECIALIDAD: Record<Especialidad, EscenaDef> = {
  reproduccion: escena(Dna, "arcilla"),
  sanidad: escena(ShieldPlus, "musgo", Syringe),
  cirugia: escena(Scissors, "ocre"),
  nutricion: escena(Wheat, "ambar"),
  calidad_leche: ESC.leche,
};

export const ESCENA_FORMACION: Record<Formacion, EscenaDef> = {
  empirica: escena(Sprout, "oliva"),
  tecnica: escena(Wrench, "ocre"),
  tecnologica: escena(Cog, "musgo"),
  profesional: escena(GraduationCap, "arcilla"),
};

export const ESCENA_TURNO: Record<Turno, EscenaDef> = {
  manana: escena(Sunrise, "ambar"),
  tarde: escena(Sunset, "arcilla"),
  ambos: escena(Sun, "ocre"),
};

export const ESCENA_TIPO_ORDENO: Record<TipoOrdeno, EscenaDef> = {
  manual: escena(Hand, "ocre", Milk),
  mecanico: escena(Cog, "musgo", Milk),
  ambos: escena(ArrowLeftRight, "oliva", Milk),
};

export const ESCENA_TIPO_CONTADOR: Record<TipoContador, EscenaDef> = {
  publico: escena(BadgeCheck, "ocre", Calculator),
  auxiliar: escena(ClipboardList, "grafito", Calculator),
};

export const ESCENA_LABOR: Record<Labor, EscenaDef> = {
  hato: escena(PawPrint, "oliva"),
  potreros: escena(TreePine, "musgo"),
  alimentacion: escena(Wheat, "ambar"),
  mantenimiento: escena(Hammer, "arcilla"),
  otra: escena(Wrench, "grafito"),
};

export const ESCENA_SI_NO: Record<"si" | "no", EscenaDef> = {
  si: escena(BadgeCheck, "oliva"),
  no: escena(CircleOff, "grafito"),
};
