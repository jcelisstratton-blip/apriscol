import { Crown, LayoutDashboard, Medal, Trophy } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";

/** Las participaciones en ferias: todas, las que ganaron premio y los campeonatos. */
export const ESCENA_FILTRO_PREMIOS: Record<"todos" | "premios" | "campeonatos", EscenaDef> = {
  todos: escena(LayoutDashboard, "musgo", Trophy),
  premios: escena(Medal, "ocre", Trophy),
  campeonatos: escena(Crown, "ambar", Trophy),
};
