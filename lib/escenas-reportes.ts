import { Activity, ArchiveX, Ban, Baby, Bone, Bug, CalendarClock, CalendarX, Cloud, Crown, Dna, Droplets, Eye, Footprints, Gauge, Heart, HeartCrack, HandCoins, Hourglass, Layers, Mars, Milk, Mountain, PawPrint, Scale, Search, ShieldAlert, Skull, Sprout, Stethoscope, Syringe, Tag, Timer, TriangleAlert, Venus, Waves, Wallet, Wheat } from "lucide-react";
import { escena, ESC, type EscenaDef } from "@/lib/escenas";

/** Las tarjetas de cada reporte en la pantalla de Reportes (un color por área de trabajo). */
export const ESCENA_REPORTE: Record<string, EscenaDef> = {
  inventario: escena(PawPrint, "ambar", Tag),
  salidas: escena(ArchiveX, "grafito", HandCoins),
  vacias: escena(Venus, "ocre", Heart),
  por_palpar: escena(Stethoscope, "arcilla", Search),
  gestantes: escena(Baby, "oliva", Hourglass),
  partos: escena(Baby, "ocre", Activity),
  sementales: escena(Crown, "arcilla", Dna),
  ordeno: ESC.leche,
  peso: escena(Scale, "ambar", Gauge),
  retiro: escena(ShieldAlert, "arcilla", Timer),
  sanidad: escena(Syringe, "musgo", CalendarClock),
  costos: escena(Wallet, "ambar", HandCoins),
};

/** Las opciones de los filtros de los reportes, por su valor. El mismo valor se ve igual en todos los reportes. */
export const ESCENA_FILTRO: Record<string, EscenaDef> = {
  // todas las listas
  todos: escena(PawPrint, "musgo", Sprout),
  // especie
  caprino: escena(Mountain, "oliva", Sprout),
  ovino: escena(Cloud, "ambar", Wheat),
  // inventario: categoría
  hembra_adulta: escena(Venus, "ocre", Droplets),
  macho_adulto: escena(Mars, "grafito", Crown),
  levante: escena(Sprout, "oliva", Footprints),
  cria: escena(Baby, "ambar", Heart),
  sin_edad: escena(CalendarX, "grafito", Search),
  // salidas
  venta: escena(HandCoins, "oliva", Tag),
  muerte: escena(Skull, "grafito", Bone),
  sacrificio: escena(Skull, "arcilla", Tag),
  perdida: escena(Ban, "grafito", Search),
  // vacías
  aptas: escena(Heart, "oliva", Venus),
  vacia: escena(Venus, "ocre", Heart),
  sin_datos: escena(Search, "grafito", Venus),
  // por palpar
  toca: escena(Stethoscope, "ambar", CalendarClock),
  pronto: escena(Hourglass, "musgo", Stethoscope),
  repetir: escena(Search, "arcilla", Stethoscope),
  // gestantes
  proximos: escena(Baby, "ambar", CalendarClock),
  atrasadas: escena(TriangleAlert, "arcilla", Baby),
  ultimo_tercio: escena(Hourglass, "ocre", Baby),
  por_secar: escena(Milk, "grafito", Timer),
  // partos
  normal: escena(Baby, "oliva", Heart),
  asistido: escena(Baby, "ambar", Stethoscope),
  cesarea: escena(Stethoscope, "ocre", Baby),
  aborto: escena(HeartCrack, "arcilla", TriangleAlert),
  // sementales (tipo de servicio)
  monta_natural: escena(Mars, "ocre", Heart),
  inseminacion: escena(Syringe, "ambar", Dna),
  transferencia_embrionaria: escena(Dna, "arcilla", Baby),
  // ordeño
  ordeno: ESC.leche,
  seca: escena(Waves, "grafito", Milk),
  // peso
  cc_baja: escena(Scale, "arcilla", TriangleAlert),
  cc_alta: escena(Scale, "ambar", TriangleAlert),
  sin_pesar: escena(Timer, "grafito", Scale),
  gdp_baja: escena(Gauge, "arcilla", Sprout),
  sin_pesaje: escena(Eye, "grafito", Scale),
  // retiro
  leche: ESC.leche,
  carne: escena(Skull, "arcilla", Timer),
  // sanidad
  dosis: escena(Syringe, "musgo", CalendarClock),
  famacha: escena(Eye, "arcilla", Bug),
  podologia: escena(Footprints, "ocre", Bone),
  pediluvio: escena(Waves, "ambar", Footprints),
};

/** Los grupos de la pantalla de Reportes. */
export const ESCENA_GRUPO_REPORTE: Record<string, EscenaDef> = {
  poblacion: escena(PawPrint, "ambar", Layers),
  reproduccion: escena(Heart, "arcilla", Baby),
  produccion: escena(Milk, "oliva", Droplets),
  sanidad: escena(Syringe, "musgo", Bug),
};
