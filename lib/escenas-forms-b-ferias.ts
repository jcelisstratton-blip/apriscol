import { Award, Crown, Flag, Globe, Map, MapPin, Medal, Sparkles, Star, Trophy } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { NivelFeria, ResultadoFeria } from "@/lib/tipos";

/** Qué tan grande es una feria. */
export const ESCENA_NIVEL_FERIA: Record<NivelFeria, EscenaDef> = {
  local: escena(MapPin, "oliva"),
  regional: escena(Map, "ocre", MapPin),
  nacional: escena(Flag, "musgo", Star),
  internacional: escena(Globe, "arcilla", Flag),
};

/** Lo que el jurado le dio a un animal. */
export const ESCENA_RESULTADO_FERIA: Record<ResultadoFeria, EscenaDef> = {
  gran_campeon: escena(Trophy, "ambar", Crown),
  campeon: escena(Trophy, "ocre", Star),
  subcampeon: escena(Medal, "grafito", Star),
  reservado_campeon: escena(Medal, "musgo", Trophy),
  mejor_ejemplar: escena(Star, "oliva", Sparkles),
  mencion_honor: escena(Award, "arcilla", Sparkles),
  participacion: escena(Flag, "oliva"),
  otro: escena(Sparkles, "grafito"),
};
