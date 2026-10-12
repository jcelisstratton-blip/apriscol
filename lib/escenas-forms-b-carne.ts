import { Beef, ClipboardCheck, MilkOff, Scale, Truck } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { TipoPesaje } from "@/lib/tipos";

/** Para qué es un pesaje. */
export const ESCENA_TIPO_PESAJE: Record<TipoPesaje, EscenaDef> = {
  control: escena(Scale, "musgo", ClipboardCheck),
  destete: escena(MilkOff, "ocre"),
  pre_beneficio: escena(Beef, "arcilla", Truck),
};
