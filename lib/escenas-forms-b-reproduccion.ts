import { Baby, CalendarOff, CircleHelp, Droplets, HeartPulse, RotateCcw, CircleOff, Hand, HandHelping, Handshake, Heart, HeartCrack, House, Microscope, ScanLine, Scissors, Snowflake, Stethoscope, Syringe, Truck } from "lucide-react";
import { ESC, escena, type EscenaDef } from "@/lib/escenas";
import type { IndicadorPalpacion, MetodoDiagnostico, ResultadoDiagnostico, TecnicaInseminacion, TipoParto, TipoServicio, TipoTransferencia, ViabilidadFetal } from "@/lib/tipos";

/** Cómo se hizo el servicio a una hembra. */
export const ESCENA_TIPO_SERVICIO: Record<TipoServicio, EscenaDef> = {
  monta_natural: escena(Heart, "arcilla", House),
  inseminacion: escena(Syringe, "musgo", Snowflake),
  transferencia_embrionaria: escena(Microscope, "ocre", Baby),
};

/** Técnica de una inseminación. */
export const ESCENA_TECNICA_INSEMINACION: Record<TecnicaInseminacion, EscenaDef> = {
  cervical: escena(Syringe, "musgo"),
  transcervical: escena(ScanLine, "oliva", Syringe),
  laparoscopica: escena(Scissors, "ocre", Microscope),
};

/** Estado del embrión al transferirlo. */
export const ESCENA_TIPO_TRANSFERENCIA: Record<TipoTransferencia, EscenaDef> = {
  fresco: escena(Baby, "oliva"),
  vitrificado: escena(Snowflake, "musgo", Microscope),
  congelado: escena(Snowflake, "ocre"),
};

/** Cuántos fetos se ven en la ecografía. */
export const ESCENA_FETOS: Record<number, EscenaDef> = {
  1: escena(Baby, "oliva"),
  2: escena(Baby, "musgo", Baby),
  3: escena(Baby, "ocre", Baby),
  4: escena(Baby, "arcilla", Baby),
};

/** Si el feto tiene latido. */
export const ESCENA_VIABILIDAD: Record<ViabilidadFetal, EscenaDef> = {
  latido: escena(HeartPulse, "oliva", Baby),
  sin_actividad: escena(HeartCrack, "grafito"),
};

/** Qué señal indicó la preñez (o su ausencia) en una palpación. */
export const ESCENA_INDICADOR_PALPACION: Record<IndicadorPalpacion, EscenaDef> = {
  ausencia_celo: escena(CalendarOff, "musgo"),
  retorno_celo: escena(RotateCcw, "arcilla", Heart),
  llenado_uterino: escena(Droplets, "oliva", Hand),
  revision_manual: escena(Hand, "ocre", Stethoscope),
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
  otro: ESC.registro,
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
