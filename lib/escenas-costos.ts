import {
  Archive, Banknote, Beef, Bug, CalendarClock, CircleCheck, ClipboardList, Coins, Fence, FileSpreadsheet, FlaskConical, Footprints, Fuel, Hammer, Heart, Leaf, LayoutDashboard,
  Milk, Package, PawPrint, Pill, Receipt, ScanBarcode, Scissors, ShieldPlus, Sprout, Stethoscope, Syringe, Tags, TrendingDown, TrendingUp, Truck, Users, Wallet, Warehouse, Wheat, Zap, Dna,
} from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import { ESCENA_ESPECIE } from "@/lib/escenas-forms-b-hato";
import type { GrupoGasto } from "@/lib/costos";
import type { DestinoGasto, RubroGasto } from "@/lib/tipos";

export const ESCENA_GRUPO_GASTO: Record<GrupoGasto, EscenaDef> = {
  alimentacion: escena(Wheat, "ambar", Leaf),
  sanidad: escena(Syringe, "musgo", ShieldPlus),
  reproduccion: escena(Heart, "arcilla", Dna),
  logistica: escena(Truck, "ocre", Tags),
  operacion: escena(Hammer, "grafito", Zap),
};
export const ESCENA_TODOS_GRUPOS: EscenaDef = escena(LayoutDashboard, "musgo", Coins);

export const ESCENA_RUBRO: Record<RubroGasto, EscenaDef> = {
  concentrado: escena(Package, "ambar", Wheat),
  forraje: escena(Leaf, "oliva", Sprout),
  sales_suplementos: escena(Coins, "ocre", Pill),
  leche_maternizada: escena(Milk, "musgo", Heart),
  vacunas_desparasitantes: escena(Syringe, "musgo", Bug),
  tratamientos: escena(Pill, "ocre", Stethoscope),
  pruebas_laboratorio: escena(FlaskConical, "arcilla", ClipboardList),
  podologia: escena(Footprints, "ambar", Scissors),
  bioseguridad: escena(ShieldPlus, "oliva", Bug),
  material_reproductivo: escena(Dna, "arcilla", Syringe),
  asistencia_veterinaria: escena(Stethoscope, "musgo", Heart),
  identificacion: escena(ScanBarcode, "ocre", Tags),
  fletes: escena(Truck, "grafito", Package),
  mano_obra: escena(Users, "ocre", Hammer),
  arriendo: escena(Warehouse, "grafito", Banknote),
  servicios_publicos: escena(Zap, "ambar", Wallet),
  combustible: escena(Fuel, "arcilla", Truck),
  mantenimiento: escena(Hammer, "oliva", Fence),
  otros: escena(ClipboardList, "grafito", Receipt),
};

export const ESCENA_DESTINO_GASTO: Record<DestinoGasto, EscenaDef> = {
  finca: escena(Warehouse, "musgo", Banknote),
  especie: escena(PawPrint, "oliva", ESCENA_ESPECIE.caprino.icono),
  ubicacion: escena(Fence, "ocre", Warehouse),
  lote: escena(Beef, "arcilla", Package),
  animal: escena(PawPrint, "ambar", Tags),
};

export const ESCENA_PAGO = {
  pagado: escena(CircleCheck, "oliva", Banknote),
  por_pagar: escena(CalendarClock, "ambar", Receipt),
} as const;

/** Las pestañas del menú Costos (se suman a ESCENA_PESTANA). */
export const ESCENA_PESTANA_COSTOS: Record<string, EscenaDef> = {
  resumen: escena(LayoutDashboard, "musgo", TrendingUp),
  costos: escena(Receipt, "ocre", Coins),
  animales: escena(PawPrint, "ambar", Tags),
  reportes: escena(FileSpreadsheet, "oliva", Archive),
};

/** Cada reporte descargable. */
export const ESCENA_REPORTE: Record<string, EscenaDef> = {
  rubros: escena(Coins, "ambar", Wheat),
  meses: escena(TrendingUp, "musgo", Banknote),
  detalle: escena(Receipt, "ocre", ClipboardList),
  animales: escena(PawPrint, "ambar", Tags),
  pendientes: escena(CalendarClock, "arcilla", Wallet),
  resultado: escena(TrendingDown, "grafito", TrendingUp),
};

export { ESCENA_ESPECIE };
