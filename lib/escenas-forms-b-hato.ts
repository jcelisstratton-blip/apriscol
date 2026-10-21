import { Beef, Cloud, Crown, CircleHelp, House, Layers, Mars, Milk, Mountain, ShoppingCart, Sprout, Venus, Wheat } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { Especie, SexoAnimal, Vocacion } from "@/lib/tipos";

/** Especie del animal (y de la temporada de monta). */
export const ESCENA_ESPECIE: Record<Especie, EscenaDef> = {
  caprino: escena(Mountain, "oliva", Sprout),
  ovino: escena(Cloud, "ambar", Wheat),
};

/** Sexo del animal y de una cría. */
export const ESCENA_SEXO: Record<SexoAnimal, EscenaDef> = {
  hembra: escena(Venus, "ocre", Milk),
  macho: escena(Mars, "grafito", Crown),
};

/** De dónde llegó el animal al hato. */
export const ESCENA_ORIGEN_ANIMAL: Record<"nacido_en_finca" | "comprado", EscenaDef> = {
  nacido_en_finca: escena(House, "musgo", Sprout),
  comprado: escena(ShoppingCart, "ocre"),
};

/** Aptitud de una hembra. */
export const ESCENA_VOCACION: Record<Vocacion, EscenaDef> = {
  leche: ESC.leche,
  carne: escena(Beef, "arcilla"),
  doble: escena(Layers, "ocre", Milk),
};

/** Para qué es un macho (`por_definir` no es un valor de la base: es «aún no decidido»). */
export const ESCENA_USO_MACHO: Record<"reproductor" | "carne" | "por_definir", EscenaDef> = {
  reproductor: escena(Crown, "ambar", Mars),
  carne: escena(Beef, "arcilla"),
  por_definir: escena(CircleHelp, "grafito"),
};
