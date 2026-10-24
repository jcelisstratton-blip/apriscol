import { Activity, Baby, BadgeCheck, Bandage, Bug, CircleHelp, CircleOff, Droplets, Eye, FlaskConical, Footprints, HandHelping, Hand, Heart, Microscope, Pill, Repeat, RotateCcw, Scissors, ShieldAlert, ShieldCheck, ShieldPlus, Skull, Stethoscope, Sun, Syringe, TestTube, Thermometer, Waves, Wheat, Wind, Zap } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";

/** Las tarjetas de cada opción de un registro sanitario, por «grupo:valor» (ver `lib/sanidad-campos.ts`). */
const E = escena;
export const ESCENA_CAMPO: Record<string, EscenaDef> = {
  // Vacunación: contra qué
  "vacunacion:clostridiales": E(ShieldPlus, "musgo", Syringe),
  "vacunacion:rabia": E(ShieldAlert, "arcilla"),
  "vacunacion:ectima": E(Zap, "ambar", ShieldCheck),
  "vacunacion:neumonia": E(Wind, "oliva", ShieldCheck),
  "vacunacion:linfadenitis": E(Droplets, "ocre", ShieldCheck),
  "vacunacion:otra": E(CircleHelp, "grafito", Syringe),
  // Desparasitación: contra qué parásito
  "desparasitacion:gastrointestinales": E(Bug, "arcilla", Pill),
  "desparasitacion:coccidiosis": E(Microscope, "ambar", Bug),
  "desparasitacion:pulmonares": E(Wind, "oliva", Bug),
  "desparasitacion:hepaticos": E(Droplets, "ocre", Bug),
  "desparasitacion:externos": E(Bug, "musgo", Hand),
  "desparasitacion:otro": E(CircleHelp, "grafito", Bug),
  // Tratamiento: qué se trata
  "tratamiento:infeccion": E(Pill, "arcilla", Thermometer),
  "tratamiento:respiratorio": E(Wind, "oliva", Stethoscope),
  "tratamiento:digestivo": E(Activity, "ambar", Stethoscope),
  "tratamiento:mastitis": E(Droplets, "musgo", Stethoscope),
  "tratamiento:herida": E(Bandage, "ocre", Stethoscope),
  "tratamiento:reproductivo": E(Baby, "arcilla", Stethoscope),
  "tratamiento:metabolico": E(Wheat, "ambar", Stethoscope),
  "tratamiento:otro": E(CircleHelp, "grafito", Stethoscope),
  // Podología
  "podologia:recorte": E(Scissors, "ocre", Footprints),
  "podologia:curacion": E(Bandage, "arcilla", Footprints),
  "podologia:ambos": E(Footprints, "musgo", Scissors),
  // Pediluvio: la solución
  "pediluvio:zinc": E(FlaskConical, "oliva", Waves),
  "pediluvio:formol": E(FlaskConical, "ambar", Waves),
  "pediluvio:cobre": E(Skull, "arcilla", Waves),
  "pediluvio:otra": E(CircleHelp, "grafito", Waves),
  // Cirugía: cuál
  "cirugia:castracion": E(Scissors, "grafito"),
  "cirugia:descorne": E(Scissors, "ocre"),
  "cirugia:cesarea": E(Baby, "arcilla", Scissors),
  "cirugia:absceso": E(Bandage, "ambar", Scissors),
  "cirugia:hernia": E(Heart, "musgo", Scissors),
  "cirugia:ubre": E(Droplets, "oliva", Scissors),
  "cirugia:otra": E(CircleHelp, "grafito", Scissors),
  // Vacunación: etapa
  "etapa:primera": E(Syringe, "oliva"),
  "etapa:refuerzo": E(Repeat, "musgo", Syringe),
  "etapa:anual": E(RotateCcw, "ocre", Syringe),
  // Desparasitación: motivo
  "motivo:famacha": E(Eye, "arcilla", Stethoscope),
  "motivo:coprologico": E(TestTube, "ambar", Microscope),
  "motivo:rutina": E(Repeat, "musgo"),
  "motivo:otro": E(CircleHelp, "grafito"),
  // Podología: cojera
  "cojera:0": E(BadgeCheck, "oliva", Footprints),
  "cojera:1": E(Footprints, "ambar"),
  "cojera:2": E(Footprints, "ocre", Activity),
  "cojera:3": E(Footprints, "arcilla", ShieldAlert),
  // Cirugía: anestesia
  "anestesia:ninguna": E(CircleOff, "grafito"),
  "anestesia:local": E(Syringe, "oliva"),
  "anestesia:sedacion": E(HandHelping, "musgo", Syringe),
  "anestesia:general": E(Sun, "ocre", Syringe),
};

export const ESCENA_SI_NO_MEDICAMENTO: Record<"si" | "no", EscenaDef> = { si: E(Pill, "musgo", Syringe), no: E(CircleOff, "grafito") };
/** Cuando no hay una escena para una opción. */
export const ESCENA_GENERICA: EscenaDef = ESC.registro;
