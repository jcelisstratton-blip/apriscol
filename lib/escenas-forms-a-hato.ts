import { Baby, Bandage, Beef, Calculator, CircleDollarSign, ClipboardList, Crown, Flower2, Handshake, Hourglass, MapPinOff, Milk, Droplets, PawPrint, ReceiptText, Settings2, ShieldCheck, Stethoscope, Syringe, TrendingDown, Calendar, Utensils, HeartCrack } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { MotivoBaja, RolFinca, TipoBaja } from "@/lib/tipos";

/** Qué le pasó a un animal que sale del hato. */
export const ESCENA_TIPO_BAJA: Record<TipoBaja, EscenaDef> = {
  venta: escena(Handshake, "oliva", CircleDollarSign),
  muerte: escena(Flower2, "grafito"),
  sacrificio: escena(Beef, "arcilla", Utensils),
  perdida: escena(MapPinOff, "ambar", PawPrint),
};

/** Por qué sale un animal del hato (motivo de descarte). */
export const ESCENA_MOTIVO_BAJA: Record<MotivoBaja, EscenaDef> = {
  edad: escena(Hourglass, "musgo", Calendar),
  partos: escena(Baby, "ocre"),
  baja_produccion: escena(TrendingDown, "ambar", Milk),
  sanidad: escena(Stethoscope, "arcilla", Syringe),
  reproductivo: escena(HeartCrack, "oliva"),
  accidente: escena(Bandage, "ocre"),
  otro: escena(ClipboardList, "grafito"),
};

/** El rol de una persona del equipo de la finca. */
export const ESCENA_ROL: Record<RolFinca, EscenaDef> = {
  propietario: escena(Crown, "ambar", ShieldCheck),
  administrador: escena(ShieldCheck, "musgo", Settings2),
  ordenador: escena(Milk, "oliva", Droplets),
  veterinario: escena(Stethoscope, "arcilla", Syringe),
  contador: escena(Calculator, "ocre", ReceiptText),
};
