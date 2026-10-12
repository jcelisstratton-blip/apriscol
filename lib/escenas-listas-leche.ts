import { ClipboardCheck, Clock, Container, CookingPot, Droplets, Factory, FlaskConical, Handshake, LayoutDashboard, Microscope, Milk, Package, PawPrint, Truck, TriangleAlert, Venus } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { DestinoLeche } from "@/lib/tipos";

/** A quién se despacha la leche, con su escena. */
export const ESCENA_DESTINO_LECHE: Record<DestinoLeche, EscenaDef> = {
  industria: escena(Factory, "ocre", Truck),
  queseria: escena(CookingPot, "ambar", Milk),
  venta_directa: escena(Handshake, "oliva", Droplets),
  otro: escena(Package, "grafito"),
};
/** «Todos» en el filtro de despachos. */
export const ESCENA_TODOS_DESTINOS: EscenaDef = escena(LayoutDashboard, "musgo", Truck);

/** De dónde sale una muestra de calidad: del tanque o lote, o de un animal. */
export const ESCENA_ORIGEN_CALIDAD: Record<"todos" | "tanque" | "animales", EscenaDef> = {
  todos: escena(LayoutDashboard, "musgo", FlaskConical),
  tanque: escena(Container, "ocre", Droplets),
  animales: escena(PawPrint, "arcilla", Microscope),
};

/** El filtro de las hembras en leche de Calidad. */
export const ESCENA_FILTRO_CALIDAD_ANIMALES: Record<"todas" | "sin" | "altas", EscenaDef> = {
  todas: escena(Venus, "musgo", Milk),
  sin: escena(FlaskConical, "grafito", Clock),
  altas: escena(TriangleAlert, "arcilla", Microscope),
};

/** Pendientes y registradas en la captura de leche. */
export const ESCENA_VISTA_CAPTURA: Record<"pendientes" | "hechas", EscenaDef> = {
  pendientes: escena(Clock, "ambar", Milk),
  hechas: escena(ClipboardCheck, "oliva", Droplets),
};
