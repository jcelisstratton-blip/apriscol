import { Axe, Banknote, Beef, CircleDashed, FolderCheck, Layers, LayoutDashboard, LogOut, Mars, PawPrint, Scale, Store, Truck, Utensils, Venus } from "lucide-react";
import { escena, type EscenaDef, type Tono } from "@/lib/escenas";

/** El grupo de candidatos a ceba: todos, hembras o machos. */
export const ESCENA_GRUPO_CANDIDATOS: Record<"todos" | "hembras" | "machos", EscenaDef> = {
  todos: escena(LayoutDashboard, "musgo", Beef),
  hembras: escena(Venus, "ocre", Scale),
  machos: escena(Mars, "grafito", Beef),
};

/** Cómo salió un animal de la ceba. */
export const ESCENA_SALIDA: Record<"todas" | "sacrificio" | "consumo" | "pie", EscenaDef> = {
  todas: escena(LayoutDashboard, "musgo", LogOut),
  sacrificio: escena(Axe, "arcilla", Beef),
  consumo: escena(Utensils, "ocre", Store),
  pie: escena(PawPrint, "oliva", Banknote),
};

/** Lotes abiertos y cerrados. */
export const ESCENA_ESTADO_LOTE: Record<"abiertos" | "cerrados", EscenaDef> = {
  abiertos: escena(Layers, "oliva", Beef),
  cerrados: escena(FolderCheck, "grafito", Truck),
};

/** Los filtros por lote del pesaje: «Todos», «Sin lote» y una escena de lote que cambia de color según su lugar en la fila. */
export const ESCENA_TODOS_LOS_LOTES: EscenaDef = escena(LayoutDashboard, "musgo", Scale);
export const ESCENA_SIN_LOTE: EscenaDef = escena(CircleDashed, "grafito", Beef);
const TONOS_LOTE: Tono[] = ["ocre", "oliva", "arcilla", "ambar"];
export const escenaLote = (i: number): EscenaDef => escena(Layers, TONOS_LOTE[i % TONOS_LOTE.length], Beef);
