import { ArrowRightLeft, Baby, Banknote, CloudUpload, Fence, Heart, LogOut, PawPrint, Plus, Receipt, Scale, ShieldPlus, ShoppingCart, Stethoscope, Syringe } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { VistaCampo } from "@/lib/campo";

/**
 * La escena de cada opción de «Registrar sin señal»: la misma en la pantalla del celular (`PantallaCampo`) y en las tarjetas de la pantalla de entrada
 * (sección «Sin señal»), para que se reconozcan.
 */
export const ESCENA_OPCION_CAMPO: Record<VistaCampo, EscenaDef> = {
  animal: escena(PawPrint, "ambar", Plus),
  ordeno: ESC.leche,
  pesar: escena(Scale, "arcilla"),
  monta: escena(Heart, "ocre"),
  diagnostico: escena(Stethoscope, "musgo"),
  parto: escena(Baby, "ocre", Heart),
  sanidad: escena(Syringe, "musgo", ShieldPlus),
  corrales: escena(Fence, "oliva", ArrowRightLeft),
  compra: escena(ShoppingCart, "ocre", Receipt),
  venta: escena(Banknote, "musgo", Receipt),
  baja: escena(LogOut, "arcilla", PawPrint),
  bandeja: escena(CloudUpload, "grafito"),
};
