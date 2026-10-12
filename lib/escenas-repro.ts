import { CalendarCheck, CalendarHeart, Heart } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";

/** El estado de una temporada de monta (empadronamiento), con su escena. */
export const ESCENA_ESTADO_EMP: Record<"todas" | "abiertas" | "cerradas", EscenaDef> = {
  todas: escena(Heart, "arcilla", CalendarHeart),
  abiertas: escena(CalendarHeart, "oliva", Heart),
  cerradas: escena(CalendarCheck, "grafito", Heart),
};
