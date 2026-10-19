import {
  Archive, Banknote, Beef, Bug, CalendarClock, CircleCheck, ClipboardList, Coins, Fence, FileSpreadsheet, FlaskConical, Footprints, Fuel, Hammer, Heart, Leaf, LayoutDashboard,
  Milk, Package, PawPrint, UserCheck, UserRound, Pill, Receipt, ScanBarcode, Scissors, ShieldPlus, Sprout, Stethoscope, Syringe, Tags, TrendingDown, TrendingUp, Truck, Users, Wallet, Warehouse, Wheat, Zap, Dna,
} from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import { ESCENA_ESPECIE } from "@/lib/escenas-forms-b-hato";
import type { GrupoCosto, GrupoGasto } from "@/lib/costos";
import type { FormaPago, Vinculacion } from "@/lib/tipos";
import type { DestinoGasto, LineaVenta, RubroGasto } from "@/lib/tipos";

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

/** Los grupos con que se reporta el costo: los cinco de compra más la mano de obra y la compra de animales. */
export const ESCENA_GRUPO_COSTO: Record<GrupoCosto, EscenaDef> = {
  ...ESCENA_GRUPO_GASTO,
  personal: escena(Users, "ocre", Hammer),
  animales: escena(PawPrint, "ambar", Banknote),
};

/** Las líneas de ingreso (lo que se vende). */
export const ESCENA_LINEA_VENTA: Record<LineaVenta, EscenaDef> = {
  leche: escena(Milk, "oliva", Package),
  animales: escena(PawPrint, "ambar", Tags),
  carne: escena(Beef, "arcilla", Package),
  derivados: escena(Milk, "ocre", Heart),
  subproductos: escena(Sprout, "oliva", Leaf),
  otros: escena(ClipboardList, "grafito", Receipt),
};
export const ESCENA_TODAS_LINEAS: EscenaDef = escena(LayoutDashboard, "musgo", TrendingUp);

/** Si ya se cobró o queda por cobrar. */
export const ESCENA_COBRO = {
  cobrado: escena(CircleCheck, "oliva", Banknote),
  por_cobrar: escena(CalendarClock, "ambar", Receipt),
} as const;

/** Las pestañas del menú Costos (se suman a ESCENA_PESTANA). */
export const ESCENA_PESTANA_COSTOS: Record<string, EscenaDef> = {
  resumen: escena(LayoutDashboard, "musgo", TrendingUp),
  compras: escena(Receipt, "ocre", Coins),
  ventas: escena(Banknote, "oliva", TrendingUp),
  costos: escena(Receipt, "ocre", Coins),
  animales: escena(PawPrint, "ambar", Tags),
  reportes: escena(FileSpreadsheet, "oliva", Archive),
  personal: escena(Users, "ocre", Hammer),
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

/** Nómina: cómo está vinculada una persona, cómo se le paga y si sigue trabajando. */
export const ESCENA_VINCULACION: Record<Vinculacion, EscenaDef> = {
  laboral: escena(UserCheck, "musgo", ShieldPlus),
  servicios: escena(FileSpreadsheet, "ocre", Receipt),
};
export const ESCENA_FORMA_PAGO: Record<FormaPago, EscenaDef> = {
  mensual: escena(CalendarClock, "ambar", Banknote),
  jornal: escena(Hammer, "arcilla", Coins),
  por_servicio: escena(Stethoscope, "oliva", Receipt),
};
export const ESCENA_ACTIVA = {
  si: escena(UserCheck, "oliva", CircleCheck),
  no: escena(UserRound, "grafito", Archive),
} as const;

export { ESCENA_ESPECIE };
