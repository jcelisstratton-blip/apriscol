import { Activity, ClipboardCheck, Droplet, Factory, FlaskConical, Gauge, Handshake, Milk, Pill, Search, ShieldAlert, ShieldCheck, SprayCan, Droplets, Snowflake, Store, Thermometer, Truck, TriangleAlert, Warehouse, Wind, Wrench, Zap, Beef } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { DestinoLeche, MomentoFrio, ResiduosAntibioticos, ResultadoControl, TipoMantenimiento } from "@/lib/tipos";

/** Qué tarea se hizo en el equipo de ordeño. */
export const ESCENA_MANTENIMIENTO: Record<TipoMantenimiento, EscenaDef> = {
  lavado_alcalino: escena(SprayCan, "oliva", Droplets),
  lavado_acido: escena(FlaskConical, "ambar", Droplet),
  presion_vacio: escena(Gauge, "ocre", Wind),
  pulsadores: escena(Activity, "arcilla", Zap),
  revision: escena(ClipboardCheck, "musgo", Wrench),
  otro: escena(Wrench, "grafito"),
};

/** Cuándo se midió la temperatura de la leche. */
export const ESCENA_MOMENTO_FRIO: Record<MomentoFrio, EscenaDef> = {
  tras_ordeno: escena(Milk, "oliva", Thermometer),
  almacenada: escena(Snowflake, "musgo", Warehouse),
  despacho: escena(Truck, "ocre", Thermometer),
};

/** A dónde fue la leche despachada. */
export const ESCENA_DESTINO_LECHE: Record<DestinoLeche, EscenaDef> = {
  industria: escena(Factory, "ocre", Truck),
  queseria: escena(Milk, "ambar", Store),
  venta_directa: escena(Handshake, "oliva", Store),
  otro: ESC.producto,
};

/** Residuos de antibióticos en la leche. */
export const ESCENA_RESIDUOS: Record<ResiduosAntibioticos, EscenaDef> = {
  negativo: escena(ShieldCheck, "oliva", Milk),
  positivo: escena(ShieldAlert, "arcilla", Pill),
};

/** Resultado de la inspección de un control de carne. */
export const ESCENA_INSPECCION: Record<ResultadoControl, EscenaDef> = {
  conforme: escena(ClipboardCheck, "oliva", Beef),
  no_conforme: escena(TriangleAlert, "arcilla", Search),
};

