import { diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import type { ResultadoPrueba, TipoEvento, TipoProducto, TipoPrueba, ViaAplicacion } from "@/lib/tipos";

export const TIPOS_EVENTO: TipoEvento[] = ["vacunacion", "desparasitacion", "tratamiento", "podologia", "pediluvio", "cirugia", "otro"];
export const ETIQUETA_EVENTO: Record<TipoEvento, string> = {
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
  tratamiento: "Tratamiento",
  podologia: "Podología",
  pediluvio: "Pediluvio",
  cirugia: "Cirugía",
  otro: "Otro",
};
/** Los tipos que llevan un producto aplicado (la cirugía y «otro» pueden no tenerlo). */
export const EVENTO_CON_PRODUCTO: TipoEvento[] = ["vacunacion", "desparasitacion", "tratamiento"];
/** Los tipos donde tiene sentido programar una próxima dosis. */
export const EVENTO_CON_REFUERZO: TipoEvento[] = ["vacunacion", "desparasitacion", "tratamiento", "podologia", "pediluvio"];

export const TIPOS_PRODUCTO: TipoProducto[] = ["vacuna", "desparasitante", "antibiotico", "antiinflamatorio", "vitamina", "otro"];
export const ETIQUETA_PRODUCTO: Record<TipoProducto, string> = {
  vacuna: "Vacuna",
  desparasitante: "Desparasitante",
  antibiotico: "Antibiótico",
  antiinflamatorio: "Antiinflamatorio",
  vitamina: "Vitamina o suplemento",
  otro: "Otro",
};
/** El tipo de evento que corresponde a cada tipo de producto (para proponerlo al elegir el producto). */
export const EVENTO_DE_PRODUCTO: Record<TipoProducto, TipoEvento> = {
  vacuna: "vacunacion",
  desparasitante: "desparasitacion",
  antibiotico: "tratamiento",
  antiinflamatorio: "tratamiento",
  vitamina: "tratamiento",
  otro: "tratamiento",
};

export const VIAS: ViaAplicacion[] = ["oral", "subcutanea", "intramuscular", "intravenosa", "topica", "intramamaria", "otra"];
export const ETIQUETA_VIA: Record<ViaAplicacion, string> = {
  oral: "Oral",
  subcutanea: "Subcutánea",
  intramuscular: "Intramuscular",
  intravenosa: "Intravenosa",
  topica: "Tópica",
  intramamaria: "Intramamaria",
  otra: "Otra",
};

export const UNIDADES_DOSIS = ["ml", "mg", "g", "cc", "tableta", "dosis"];

export const TIPOS_PRUEBA: TipoPrueba[] = ["cae", "brucelosis", "cmt", "mastitis_cultivo", "paratuberculosis", "otra"];
export const ETIQUETA_PRUEBA: Record<TipoPrueba, string> = {
  cae: "CAE (artritis encefalitis caprina)",
  brucelosis: "Brucelosis",
  cmt: "CMT (mastitis)",
  mastitis_cultivo: "Cultivo de mastitis",
  paratuberculosis: "Paratuberculosis",
  otra: "Otra prueba",
};
export const ETIQUETA_PRUEBA_CORTA: Record<TipoPrueba, string> = {
  cae: "CAE",
  brucelosis: "Brucelosis",
  cmt: "CMT",
  mastitis_cultivo: "Cultivo de mastitis",
  paratuberculosis: "Paratuberculosis",
  otra: "Otra prueba",
};
export const RESULTADOS_PRUEBA: ResultadoPrueba[] = ["negativo", "positivo", "sospechoso", "pendiente"];
export const ETIQUETA_RESULTADO_PRUEBA: Record<ResultadoPrueba, string> = {
  negativo: "Negativo",
  positivo: "Positivo",
  sospechoso: "Sospechoso",
  pendiente: "Pendiente",
};
export const TONO_RESULTADO_PRUEBA: Record<ResultadoPrueba, "ok" | "alerta" | "aviso" | "neutro"> = {
  negativo: "ok",
  positivo: "alerta",
  sospechoso: "aviso",
  pendiente: "neutro",
};

/** Último día incluido del retiro (igual que la columna generada de la base: fecha + días). */
export function finRetiro(fecha: string, dias: number): string {
  return sumarDias(fecha, dias);
}

/** Frase para la persona: hasta cuándo no sirve la leche o la carne. */
export function textoRetiro(fecha: string, diasLeche: number, diasCarne: number): string[] {
  const frases: string[] = [];
  if (diasLeche > 0) frases.push(`La leche no va al tanque hasta el ${formatoFecha(finRetiro(fecha, diasLeche), { day: "numeric", month: "long", year: "numeric" })}.`);
  if (diasCarne > 0) frases.push(`La carne no puede salir para consumo hasta el ${formatoFecha(finRetiro(fecha, diasCarne), { day: "numeric", month: "long", year: "numeric" })}.`);
  return frases;
}

/** Estado de una próxima dosis respecto a hoy. */
export function estadoDosis(proxima: string, hoy: string): { dias: number; texto: string; tono: "alerta" | "aviso" | "neutro" } {
  const dias = diasHasta(proxima, hoy);
  if (dias < 0) return { dias, texto: `Vencida hace ${-dias} ${dias === -1 ? "día" : "días"}`, tono: "alerta" };
  if (dias === 0) return { dias, texto: "Es hoy", tono: "aviso" };
  if (dias <= 7) return { dias, texto: `En ${dias} ${dias === 1 ? "día" : "días"}`, tono: "aviso" };
  return { dias, texto: `En ${dias} días`, tono: "neutro" };
}

/** Nombre a mostrar de un evento: el producto, o el tipo si no lleva producto. */
export function nombreEvento(e: { tipo: TipoEvento | null; producto_nombre: string | null }): string {
  return e.producto_nombre?.trim() || (e.tipo ? ETIQUETA_EVENTO[e.tipo] : "Evento");
}

// ───────────────────────── Programación sanitaria ─────────────────────────
/** Los tipos que se pueden programar (lo que se aplica a varios animales en una jornada). */
export const TIPOS_PROGRAMABLES: TipoEvento[] = ["vacunacion", "desparasitacion", "tratamiento", "podologia", "pediluvio", "cirugia", "otro"];

/** Cómo va una programación respecto a su fecha: vencida, para hoy, próxima o lejana. */
export function estadoFechaPrograma(fecha: string, hoy: string): { dias: number; texto: string; tono: "alerta" | "aviso" | "neutro" } {
  const dias = diasHasta(fecha, hoy);
  if (dias < 0) return { dias, texto: `Vencida hace ${-dias} ${dias === -1 ? "día" : "días"}`, tono: "alerta" };
  if (dias === 0) return { dias, texto: "Es hoy", tono: "aviso" };
  if (dias <= 7) return { dias, texto: `En ${dias} ${dias === 1 ? "día" : "días"}`, tono: "aviso" };
  return { dias, texto: `En ${dias} días`, tono: "neutro" };
}
