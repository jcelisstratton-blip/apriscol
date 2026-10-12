import { Baby, CircleHelp, CircleOff, ClipboardList, Hand, HandHelping, Handshake, Heart, HeartCrack, House, Microscope, ScanLine, Scissors, Snowflake, Stethoscope, Syringe, Truck } from "lucide-react";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { MetodoDiagnostico, ResultadoDiagnostico, TipoParto, TipoServicio } from "@/lib/tipos";

/** Cómo se hizo el servicio a una hembra. */
export const ESCENA_TIPO_SERVICIO: Record<TipoServicio, EscenaDef> = {
  monta_natural: escena(Heart, "arcilla", House),
  inseminacion: escena(Syringe, "musgo", Snowflake),
  transferencia_embrionaria: escena(Microscope, "ocre", Baby),
};

/** Qué pasó en un parto. */
export const ESCENA_TIPO_PARTO: Record<TipoParto, EscenaDef> = {
  normal: escena(Baby, "oliva", Heart),
  asistido: escena(HandHelping, "ocre", Baby),
  cesarea: escena(Scissors, "musgo", Stethoscope),
  aborto: escena(HeartCrack, "grafito"),
};

/** Con qué se hizo el diagnóstico de gestación. */
export const ESCENA_METODO_DIAGNOSTICO: Record<MetodoDiagnostico, EscenaDef> = {
  ecografia: escena(ScanLine, "musgo", Stethoscope),
  palpacion: escena(Hand, "ocre", Stethoscope),
  otro: escena(ClipboardList, "grafito"),
};

/** Qué resultó del diagnóstico. */
export const ESCENA_RESULTADO_DIAGNOSTICO: Record<ResultadoDiagnostico, EscenaDef> = {
  gestante: escena(Baby, "oliva", Heart),
  vacia: escena(CircleOff, "arcilla"),
  dudoso: escena(CircleHelp, "ambar", Stethoscope),
};

/** De dónde viene el semental de una temporada de monta. */
export const ESCENA_ORIGEN_SEMENTAL: Record<"propio" | "externo", EscenaDef> = {
  propio: escena(House, "musgo", Heart),
  externo: escena(Handshake, "ocre", Truck),
};
