import { Dna, Eye, Heart, LayoutDashboard, Mars, ShieldCheck, TriangleAlert, Venus } from "lucide-react";
import { escena, type EscenaDef, type Tono } from "@/lib/escenas";

/** Los grupos de la lista de endogamia (iguales a los colores de nivel: rojo alto, ámbar vigilar, verde aceptable). */
export const ESCENA_FILTRO_ENDOGAMIA: Record<"umbral" | "vigilar" | "aceptables" | "todos", EscenaDef> = {
  umbral: escena(TriangleAlert, "arcilla", Dna),
  vigilar: escena(Eye, "ambar", Dna),
  aceptables: escena(ShieldCheck, "oliva", Dna),
  todos: escena(LayoutDashboard, "musgo", Dna),
};

/** Las hembras de una temporada: «Todos» y un semental, con un color distinto según su lugar en la fila. */
export const ESCENA_TODOS_SEMENTALES: EscenaDef = escena(Venus, "musgo", Heart);
const TONOS_SEMENTAL: Tono[] = ["grafito", "ocre", "arcilla", "oliva", "ambar"];
export const escenaSemental = (i: number): EscenaDef => escena(Mars, TONOS_SEMENTAL[i % TONOS_SEMENTAL.length], Heart);
