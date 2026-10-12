import { ArrowUpFromLine, Baby, Beef, BrickWall, Droplets, Fence, Grid3x3, Heart, Layers, Milk, Moon, Mountain, PawPrint, Repeat, Scale, ShieldAlert, Sprout, Syringe, TrendingUp, Venus, Warehouse } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { PisoUbicacion, UsoUbicacion } from "@/lib/tipos";

/** Para qué se usa un corral o potrero. */
export const ESCENA_USO_UBICACION: Record<UsoUbicacion, EscenaDef> = {
  general: escena(Warehouse, "grafito", Fence),
  ordeno: escena(Milk, "oliva", Droplets),
  maternidad: escena(Baby, "ocre", Heart),
  crias: escena(Sprout, "musgo", PawPrint),
  cuarentena: escena(ShieldAlert, "arcilla", Syringe),
  alta_produccion: escena(TrendingUp, "ambar", Milk),
  secas: escena(Moon, "grafito", Milk),
  reproductoras: escena(Heart, "arcilla", Venus),
  ceba: escena(Beef, "ocre", Scale),
  reemplazos: escena(Repeat, "oliva", PawPrint),
};

/** El piso de un corral. */
export const ESCENA_PISO: Record<PisoUbicacion, EscenaDef> = {
  elevado: escena(ArrowUpFromLine, "musgo", Fence),
  emparrillado: escena(Grid3x3, "oliva", Droplets),
  tierra: escena(Mountain, "ocre", PawPrint),
  cemento: escena(BrickWall, "grafito", Layers),
  pasto: escena(Sprout, "oliva", PawPrint),
  otro: escena(Layers, "ambar"),
};
