import { ArrowRightLeft, Baby, ClipboardList, Fence, Heart, LayoutDashboard, LogIn, PawPrint, Repeat, ShieldAlert, Sprout, Syringe, Warehouse } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { MotivoMovimiento, TipoUbicacion } from "@/lib/tipos";

/** Cada motivo de un movimiento de animales, con su escena. */
export const ESCENA_MOTIVO: Record<MotivoMovimiento, EscenaDef> = {
  traslado: escena(ArrowRightLeft, "ocre", Fence),
  rotacion: escena(Repeat, "oliva", Sprout),
  ingreso: escena(LogIn, "musgo", PawPrint),
  cuarentena: escena(ShieldAlert, "arcilla", Syringe),
  maternidad: escena(Baby, "ocre", Heart),
  otro: escena(ClipboardList, "grafito"),
};
export const ESCENA_TODOS_MOTIVOS: EscenaDef = escena(LayoutDashboard, "musgo", ArrowRightLeft);

export const ESCENA_TIPO_UBICACION: Record<TipoUbicacion, EscenaDef> = {
  corral: escena(Warehouse, "ocre", Fence),
  potrero: escena(Sprout, "oliva", PawPrint),
};
