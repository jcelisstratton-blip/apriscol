import { Bell, CheckCheck, Eye, Inbox, LayoutDashboard } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { EstadoNovedad } from "@/lib/novedades";

/** Cada estado de una novedad, con su escena. */
export const ESCENA_ESTADO_NOVEDAD: Record<EstadoNovedad, EscenaDef> = {
  nueva: escena(Bell, "arcilla", Inbox),
  vista: escena(Eye, "ambar", Inbox),
  atendida: escena(CheckCheck, "oliva", Inbox),
};
/** «Todas» en el filtro de novedades. */
export const ESCENA_TODAS_NOVEDADES: EscenaDef = escena(LayoutDashboard, "musgo", Inbox);
