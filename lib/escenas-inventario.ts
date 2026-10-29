import { AlertTriangle, BellRing, Boxes, ClipboardList, PackageCheck, PackageMinus, PackageX, TriangleAlert } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { EstadoStock, MotivoAjuste } from "@/lib/inventario";

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
