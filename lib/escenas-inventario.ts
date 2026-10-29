import { AlertTriangle, BellRing, Boxes, ClipboardList, HelpCircle, PackageCheck, PackageMinus, PackageX, TimerReset, TriangleAlert, Wheat } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { EstadoStock, MotivoAjuste } from "@/lib/inventario";
import type { EstadoAlimento } from "@/lib/inventario-alimento";

/** Cada estado del stock, con su escena. */
export const ESCENA_ESTADO_STOCK: Record<EstadoStock, EscenaDef> = {
  sin_contar: escena(ClipboardList, "ambar", Boxes),
  negativo: escena(TriangleAlert, "arcilla", Boxes),
  agotado: escena(PackageX, "arcilla", Boxes),
  bajo: escena(PackageMinus, "ambar", Boxes),
  ok: escena(PackageCheck, "oliva", Boxes),
};
/** Los filtros de la lista: todos, los que piden atención, los que faltan por contar y los que están al día. */
export const ESCENA_TODOS_INVENTARIO: EscenaDef = escena(Boxes, "musgo");
export const ESCENA_ATENCION_INVENTARIO: EscenaDef = escena(BellRing, "arcilla", AlertTriangle);

/** El motivo de un ajuste, para elegirlo en el formulario. */
export const ESCENA_MOTIVO_AJUSTE: Record<MotivoAjuste, EscenaDef> = {
  conteo: escena(ClipboardList, "musgo"),
  vencido: escena(PackageX, "arcilla"),
  perdida: escena(PackageMinus, "ambar"),
  dano: escena(TriangleAlert, "grafito"),
  otro: escena(Boxes, "oliva"),
};

/** Cada estado de un alimento, con su escena. */
export const ESCENA_ESTADO_ALIMENTO: Record<EstadoAlimento, EscenaDef> = {
  sin_contar: escena(ClipboardList, "ambar", Wheat),
  negativo: escena(TriangleAlert, "arcilla", Wheat),
  agotado: escena(PackageX, "arcilla", Wheat),
  critico: escena(TimerReset, "arcilla", Wheat),
  bajo: escena(PackageMinus, "ambar", Wheat),
  ok: escena(PackageCheck, "oliva", Wheat),
  sin_datos: escena(HelpCircle, "grafito", Wheat),
};
export const ESCENA_TODOS_ALIMENTO: EscenaDef = escena(Wheat, "musgo", Boxes);
