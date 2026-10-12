import type { EstadoUbicacion, MotivoMovimiento, PisoUbicacion, TipoUbicacion, UsoUbicacion } from "@/lib/tipos";

export const TIPOS_UBICACION: TipoUbicacion[] = ["corral", "potrero"];
export const ETIQUETA_TIPO_UBICACION: Record<TipoUbicacion, string> = { corral: "Corral", potrero: "Potrero" };

export const USOS: UsoUbicacion[] = ["general", "ordeno", "maternidad", "crias", "cuarentena", "alta_produccion", "secas", "reproductoras", "ceba", "reemplazos"];
export const ETIQUETA_USO: Record<UsoUbicacion, string> = {
  general: "General",
  ordeno: "Sala de ordeño",
  maternidad: "Maternidad (partos)",
  crias: "Crecimiento y crías",
  cuarentena: "Cuarentena",
  alta_produccion: "Alta producción",
  secas: "Secas",
  reproductoras: "Reproductoras",
  ceba: "Ceba",
  reemplazos: "Reemplazos",
};
/** Para qué sirve cada uso, en una línea (ayuda al elegirlo). */
export const AYUDA_USO: Record<UsoUbicacion, string> = {
  general: "Sin un propósito especial.",
  ordeno: "Fácil de lavar, con buena luz y piso antideslizante.",
  maternidad: "Donde la madre pasa sus últimos días de gestación y el inicio de la lactancia con sus crías.",
  crias: "Sin corrientes de aire y con comederos adaptados para los reemplazos.",
  cuarentena: "Aislado: animales enfermos o de ingreso reciente (21 a 30 días antes de pasar al lote general).",
  alta_produccion: "El lote de las que más producen.",
  secas: "Hembras que no están en leche.",
  reproductoras: "Hembras en monta y gestación.",
  ceba: "Animales en engorde.",
  reemplazos: "Hembras y machos jóvenes que reemplazarán a los actuales.",
};

export const PISOS: PisoUbicacion[] = ["elevado", "emparrillado", "tierra", "cemento", "pasto", "otro"];
export const ETIQUETA_PISO: Record<PisoUbicacion, string> = {
  elevado: "Elevado",
  emparrillado: "Emparrillado (listones)",
  tierra: "Tierra",
  cemento: "Cemento",
  pasto: "Pasto",
  otro: "Otro",
};
/** Los pisos que mantienen a los animales secos: elevado y emparrillado (la guía los recomienda por las pezuñas y los parásitos). */
export const PISOS_SECOS: PisoUbicacion[] = ["elevado", "emparrillado"];

export const MOTIVOS: MotivoMovimiento[] = ["traslado", "rotacion", "ingreso", "cuarentena", "maternidad", "otro"];
export const ETIQUETA_MOTIVO: Record<MotivoMovimiento, string> = {
  traslado: "Traslado",
  rotacion: "Rotación de potrero",
  ingreso: "Ingreso al hato",
  cuarentena: "Cuarentena",
  maternidad: "Maternidad",
  otro: "Otro",
};

export const ETIQUETA_ESTADO_UBICACION: Record<EstadoUbicacion, string> = {
  ocupado: "Ocupado",
  vacio: "Vacío",
  debe_salir: "Debe salir el lote",
  descanso: "En descanso",
  listo: "Listo para usar",
};
export const TONO_ESTADO_UBICACION: Record<EstadoUbicacion, "musgo" | "aviso" | "alerta" | "neutro"> = {
  ocupado: "musgo",
  vacio: "neutro",
  debe_salir: "alerta",
  descanso: "aviso",
  listo: "musgo",
};

/** Rotación de potreros por defecto (la guía: ocupación de 3 a 5 días y descanso de 30 a 45). */
export const DIAS_OCUPACION_DEFECTO = 5;
export const DIAS_DESCANSO_DEFECTO = 35;

/** Días mínimos y recomendados de cuarentena para un animal que llega (la guía: 21 a 30). */
export const CUARENTENA_MIN_DIAS = 21;
export const CUARENTENA_RECOMENDADA_DIAS = 30;

export function estadoCuarentena(dias: number): { texto: string; tono: "aviso" | "ok" | "neutro" } {
  if (dias >= CUARENTENA_RECOMENDADA_DIAS) return { texto: `${dias} días: lista para pasar al lote`, tono: "ok" };
  if (dias >= CUARENTENA_MIN_DIAS) return { texto: `${dias} días: cumplió el mínimo (recomendado ${CUARENTENA_RECOMENDADA_DIAS})`, tono: "neutro" };
  return { texto: `${dias} ${dias === 1 ? "día" : "días"}: faltan ${CUARENTENA_MIN_DIAS - dias} para el mínimo`, tono: "aviso" };
}

/** Cuánto ocupa una ubicación: «18 de 20» (o solo «18» si no tiene capacidad). */
export const textoOcupacion = (ocupantes: number, capacidad: number | null) => (capacidad ? `${ocupantes} de ${capacidad}` : String(ocupantes));

/** Texto corto del estado de rotación de un potrero: «Ocupado hace 3 de 5 días», «En descanso: 12 de 35 días». */
export function textoRotacion(u: { estado: EstadoUbicacion; dias_ocupacion: number | null; dias_descanso: number | null; dias_ocupacion_max: number; dias_descanso_min: number }): string {
  switch (u.estado) {
    case "ocupado":
      return `Lleva ${u.dias_ocupacion ?? 0} de ${u.dias_ocupacion_max} días de ocupación`;
    case "debe_salir":
      return `Lleva ${u.dias_ocupacion} días: pasó los ${u.dias_ocupacion_max} de ocupación`;
    case "descanso":
      return `Descansa ${u.dias_descanso ?? 0} de ${u.dias_descanso_min} días`;
    case "listo":
      return u.dias_descanso == null ? "Sin uso todavía" : `Descansó ${u.dias_descanso} días`;
    default:
      return "";
  }
}
