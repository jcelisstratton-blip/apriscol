import { leerNumero } from "@/lib/numeros";
import type { Especie } from "@/lib/tipos";

/**
 * Ajustes de la finca: los umbrales, tiempos y criterios zootécnicos que define el propietario (tablas `finca_ajustes` y `finca_ajustes_especie`).
 * Los valores de fábrica viven en la base (defaults de columna y `parametros_especie`): aquí no se repiten. Esta lista describe CÓMO se muestra y se
 * valida cada ajuste; el formulario, la acción de guardado y la lectura salen de ella para que no se desincronicen.
 */

export type GrupoAjustes = "reproduccion" | "ceba" | "leche" | "sanidad" | "nutricion" | "crecimiento" | "personal";

/** Ajustes generales de la finca (una fila). */
export type AjustesFinca = {
  finca_id: string;
  servicio_edad_min_meses: number;
  servicio_peso_adulto_pct: number;
  servicio_cc_min: number;
  dx_prenez_dia_desde: number;
  dx_prenez_dia_hasta: number;
  ultimo_tercio_dia: number;
  parto_preparar_dias: number;
  parto_vigilar_dias: number;
  vacia_aviso_dias: number;
  vacia_urgente_dias: number;
  destete_dias: number;
  corral_razon_peso: number;
  gdp_minima_g: number;
  cc_venta_min: number;
  cc_venta_max: number;
  ccs_limite_miles_ml: number;
  secado_dias_antes_parto: number;
  pediluvio_dias: number;
  pediluvio_dias_lluvia: number;
  meses_lluvia: number[];
  podologia_inspeccion_dias: number;
  vacuna_rabia_dias: number | null;
  vacuna_clostridiosis_dias: number | null;
  ms_mantenimiento_pct: number;
  ms_produccion_min_pct: number;
  ms_produccion_max_pct: number;
  stock_autonomia_dias: number;
  factor_prestacional: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

/** Ajustes que cambian entre ovinos y caprinos (una fila por especie). */
export type AjustesEspecie = {
  finca_id: string;
  especie: Especie;
  gestacion_dias: number;
  peso_adulto_hembra_kg: number | null;
  peso_faena_min_kg: number | null;
  peso_faena_max_kg: number | null;
  grasa_min_pct: number | null;
  grasa_max_pct: number | null;
  proteina_min_pct: number | null;
  proteina_max_pct: number | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type AjustesCompletos = { general: AjustesFinca; especie: Record<Especie, AjustesEspecie> };

/** Rango biológico de la gestación por especie (`parametros_especie`): dentro de él el propietario puede afinar la suya. */
export type RangoGestacion = { min: number; max: number; defecto: number };

export type ClaveGeneral = Exclude<keyof AjustesFinca, "finca_id" | "meses_lluvia" | "created_at" | "updated_at" | "updated_by">;
export type ClaveEspecie = Exclude<keyof AjustesEspecie, "finca_id" | "especie" | "created_at" | "updated_at" | "updated_by">;

export type CampoAjuste<C extends string> = {
  clave: C;
  etiqueta: string;
  /** «meses», «días», «%»… se muestra junto al campo. */
  unidad?: string;
  ayuda?: string;
  min: number;
  max: number;
  /** Cifras decimales que admite (0 = entero). */
  decimales: number;
  /** Vacío = «sin definir» (se guarda nulo). */
  opcional?: boolean;
};

export type GrupoDefinicion = {
  id: GrupoAjustes;
  titulo: string;
  detalle: string;
  /** Si lo que se define aquí todavía no dispara avisos automáticos, se le dice a la persona en lenguaje llano. */
  nota?: string;
  general: CampoAjuste<ClaveGeneral>[];
  especie: CampoAjuste<ClaveEspecie>[];
};

export const GRUPOS_AJUSTES: GrupoDefinicion[] = [
  {
    id: "reproduccion",
    titulo: "Reproducción",
    detalle: "Cuándo una hembra está lista para servirse y qué avisos recibes durante la gestación.",
    general: [
      { clave: "servicio_edad_min_meses", etiqueta: "Edad mínima para el primer servicio", unidad: "meses", ayuda: "Lo habitual es entre 7 y 9 meses.", min: 4, max: 24, decimales: 0 },
      { clave: "servicio_peso_adulto_pct", etiqueta: "Peso mínimo para el primer servicio", unidad: "% del peso adulto", ayuda: "Lo habitual es entre 60 y 70 %. Se calcula con el peso de una hembra adulta de tu finca, que escribes abajo.", min: 40, max: 100, decimales: 0 },
      { clave: "servicio_cc_min", etiqueta: "Condición corporal mínima para servir", ayuda: "En una escala de 1 a 5.", min: 1, max: 5, decimales: 1 },
      { clave: "dx_prenez_dia_desde", etiqueta: "Diagnóstico de preñez: desde el día", unidad: "después del servicio", min: 15, max: 90, decimales: 0 },
      { clave: "dx_prenez_dia_hasta", etiqueta: "Diagnóstico de preñez: hasta el día", unidad: "después del servicio", min: 15, max: 120, decimales: 0 },
      { clave: "ultimo_tercio_dia", etiqueta: "Último tercio de gestación desde el día", unidad: "de gestación", ayuda: "Desde aquí conviene reforzar la alimentación de la hembra.", min: 60, max: 140, decimales: 0 },
      { clave: "parto_preparar_dias", etiqueta: "Partos: empezar a preparar la maternidad", unidad: "días antes del parto", ayuda: "Desde aquí el semáforo avisa que se acerca un parto: hay que preparar la maternidad y vacunar.", min: 15, max: 60, decimales: 0 },
      { clave: "parto_vigilar_dias", etiqueta: "Partos: vigilar a diario", unidad: "días antes del parto", ayuda: "Desde aquí conviene revisar a la hembra todos los días.", min: 3, max: 30, decimales: 0 },
      { clave: "vacia_aviso_dias", etiqueta: "Vacía sin servicio: avisar a los", unidad: "días del parto", ayuda: "Una hembra que parió y sigue sin servirse pierde producción y tiempo. Aquí empieza el aviso.", min: 30, max: 180, decimales: 0 },
      { clave: "vacia_urgente_dias", etiqueta: "Vacía sin servicio: urgente a los", unidad: "días del parto", ayuda: "Desde aquí el semáforo se pone en rojo.", min: 60, max: 365, decimales: 0 },
    ],
    especie: [
      { clave: "gestacion_dias", etiqueta: "Duración de la gestación", unidad: "días", min: 0, max: 0, decimales: 0 },
      { clave: "peso_adulto_hembra_kg", etiqueta: "Peso de una hembra adulta", unidad: "kg", ayuda: "Sirve para calcular el peso mínimo del primer servicio. Si lo dejas vacío se usa un peso de referencia.", min: 10, max: 150, decimales: 1, opcional: true },
    ],
  },
  {
    id: "ceba",
    titulo: "Ceba y carne",
    detalle: "Qué se espera de un animal en engorde y cuándo está listo para salir.",
    general: [
      { clave: "gdp_minima_g", etiqueta: "Ganancia diaria de peso mínima", unidad: "g por día", ayuda: "Si un animal o un lote gana menos que esto, se avisa que rinde poco.", min: 0, max: 1000, decimales: 0 },
      { clave: "cc_venta_min", etiqueta: "Condición corporal para vender: desde", ayuda: "En una escala de 1 a 5. Lo habitual es entre 3,5 y 4.", min: 1, max: 5, decimales: 1 },
      { clave: "cc_venta_max", etiqueta: "Condición corporal para vender: hasta", min: 1, max: 5, decimales: 1 },
    ],
    especie: [
      { clave: "peso_faena_min_kg", etiqueta: "Peso para salir a faena: desde", unidad: "kg", min: 5, max: 150, decimales: 1, opcional: true },
      { clave: "peso_faena_max_kg", etiqueta: "Peso para salir a faena: hasta", unidad: "kg", min: 5, max: 150, decimales: 1, opcional: true },
    ],
  },
  {
    id: "leche",
    titulo: "Leche",
    detalle: "Los rangos de calidad que quieres para tu leche y el manejo del secado.",
    general: [
      { clave: "ccs_limite_miles_ml", etiqueta: "Límite de células somáticas", unidad: "mil por ml", ayuda: "500 mil por ml equivalen a 500.000 células. Por encima puede haber mastitis sin síntomas.", min: 50, max: 5000, decimales: 0 },
      { clave: "secado_dias_antes_parto", etiqueta: "Secar antes del parto", unidad: "días", ayuda: "Cuántos días antes de la fecha probable de parto se deja de ordeñar a la hembra.", min: 30, max: 90, decimales: 0 },
    ],
    especie: [
      { clave: "grasa_min_pct", etiqueta: "Grasa: mínimo", unidad: "%", min: 0, max: 15, decimales: 1, opcional: true },
      { clave: "grasa_max_pct", etiqueta: "Grasa: máximo", unidad: "%", min: 0, max: 15, decimales: 1, opcional: true },
      { clave: "proteina_min_pct", etiqueta: "Proteína: mínimo", unidad: "%", min: 0, max: 15, decimales: 1, opcional: true },
      { clave: "proteina_max_pct", etiqueta: "Proteína: máximo", unidad: "%", min: 0, max: 15, decimales: 1, opcional: true },
    ],
  },
  {
    id: "sanidad",
    titulo: "Sanidad",
    detalle: "Cada cuánto se repiten los baños de patas, la revisión de pezuñas y las vacunas obligatorias.",
    nota: "Las vacunas obligatorias quedan guardadas; el aviso automático de cada una llega más adelante.",
    general: [
      { clave: "pediluvio_dias", etiqueta: "Baño de patas (pediluvio): cada", unidad: "días", ayuda: "En época normal.", min: 7, max: 180, decimales: 0 },
      { clave: "pediluvio_dias_lluvia", etiqueta: "Baño de patas en época de lluvias: cada", unidad: "días", min: 7, max: 180, decimales: 0 },
      { clave: "podologia_inspeccion_dias", etiqueta: "Revisión de pezuñas: cada", unidad: "días", min: 30, max: 730, decimales: 0 },
      { clave: "vacuna_rabia_dias", etiqueta: "Vacuna contra la rabia: cada", unidad: "días", ayuda: "Déjalo vacío si no quieres aviso.", min: 30, max: 1095, decimales: 0, opcional: true },
      { clave: "vacuna_clostridiosis_dias", etiqueta: "Vacuna contra clostridiosis: cada", unidad: "días", ayuda: "Déjalo vacío si no quieres aviso.", min: 30, max: 1095, decimales: 0, opcional: true },
    ],
    especie: [],
  },
  {
    id: "nutricion",
    titulo: "Alimentación e inventarios",
    detalle: "Cuánto alimento seco come un animal y con cuántos días de reserva te avisa la bodega.",
    nota: "Estos valores quedan guardados y se usarán cuando llegue el control de bodega y raciones.",
    general: [
      { clave: "ms_mantenimiento_pct", etiqueta: "Alimento seco diario en mantenimiento", unidad: "% del peso vivo", ayuda: "Lo habitual es cerca de 3 %.", min: 1, max: 8, decimales: 1 },
      { clave: "ms_produccion_min_pct", etiqueta: "Alimento seco diario en gestación avanzada o lactancia: desde", unidad: "% del peso vivo", min: 1, max: 8, decimales: 1 },
      { clave: "ms_produccion_max_pct", etiqueta: "Alimento seco diario en gestación avanzada o lactancia: hasta", unidad: "% del peso vivo", ayuda: "Lo habitual es entre 3,5 y 4,5 %.", min: 1, max: 8, decimales: 1 },
      { clave: "stock_autonomia_dias", etiqueta: "Avisar cuando el alimento alcance para menos de", unidad: "días", ayuda: "Aplica a sales, melaza, concentrado y demás insumos clave.", min: 1, max: 90, decimales: 0 },
    ],
    especie: [],
  },
  {
    id: "crecimiento",
    titulo: "Crecimiento y corrales",
    detalle: "Hasta cuándo es lactante un animal y cuándo avisar que un corral mezcla animales muy distintos. La edad y el peso adulto de la hembra (Reproducción) completan las etapas.",
    general: [
      { clave: "destete_dias", etiqueta: "Destete: edad en que deja de ser lactante", unidad: "días", ayuda: "Lo habitual es entre 60 y 90 días. Después del destete, los machos y las hembras van en corrales aparte.", min: 45, max: 90, decimales: 0 },
      { clave: "corral_razon_peso", etiqueta: "Corral: avisar si el más pesado pasa al más liviano por", unidad: "veces", ayuda: "Si en un corral el animal más pesado es más de esta cantidad de veces el más liviano, se avisa: el grande desplaza al pequeño. Es un punto de partida; ajústalo con tu veterinario.", min: 1.2, max: 3, decimales: 1 },
    ],
    especie: [],
  },
  {
    id: "personal",
    titulo: "Personal y nómina",
    detalle: "Cuánto cuesta de verdad una persona con contrato de trabajo, contando las cargas de ley. Se usa en cada pago de Personal.",
    general: [
      { clave: "factor_prestacional", etiqueta: "Factor prestacional", unidad: "veces el salario", ayuda: "Multiplica el salario o el jornal para incluir prestaciones y seguridad social. En Colombia suele estar cerca de 1,63. No aplica a contratos de prestación de servicios.", min: 1, max: 3, decimales: 2 },
    ],
    especie: [],
  },
];

/** Pares «desde / hasta»: el primero no puede pasar del segundo. */
export const PARES_ORDENADOS: { menor: ClaveGeneral | ClaveEspecie; mayor: ClaveGeneral | ClaveEspecie; mensaje: string }[] = [
  { menor: "dx_prenez_dia_desde", mayor: "dx_prenez_dia_hasta", mensaje: "El diagnóstico de preñez no puede empezar después del día en que termina." },
  { menor: "parto_vigilar_dias", mayor: "parto_preparar_dias", mensaje: "Vigilar a diario no puede empezar antes que preparar la maternidad." },
  { menor: "vacia_aviso_dias", mayor: "vacia_urgente_dias", mensaje: "El aviso de una hembra vacía no puede ser después del urgente." },
  { menor: "cc_venta_min", mayor: "cc_venta_max", mensaje: "La condición corporal para vender «desde» no puede ser mayor que «hasta»." },
  { menor: "peso_faena_min_kg", mayor: "peso_faena_max_kg", mensaje: "El peso de faena «desde» no puede ser mayor que «hasta»." },
  { menor: "grasa_min_pct", mayor: "grasa_max_pct", mensaje: "El mínimo de grasa no puede ser mayor que el máximo." },
  { menor: "proteina_min_pct", mayor: "proteina_max_pct", mensaje: "El mínimo de proteína no puede ser mayor que el máximo." },
  { menor: "ms_mantenimiento_pct", mayor: "ms_produccion_min_pct", mensaje: "El alimento en mantenimiento no puede ser mayor que el de gestación o lactancia." },
  { menor: "ms_produccion_min_pct", mayor: "ms_produccion_max_pct", mensaje: "El alimento de gestación o lactancia «desde» no puede ser mayor que «hasta»." },
];

export const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Un número a la colombiana: «3,5», sin ceros de sobra. */
export const textoNumero = (n: number | null | undefined, decimales = 2) =>
  n == null ? "" : Number(n.toFixed(decimales)).toLocaleString("es-CO", { maximumFractionDigits: decimales });

/** Texto escrito → número, vacío → null (los campos opcionales). `undefined` si no es un número. */
export function leerCampo(texto: string, campo: CampoAjuste<string>): number | null | undefined {
  if (texto.trim() === "") return campo.opcional ? null : undefined;
  const n = leerNumero(texto);
  if (n == null) return undefined;
  return campo.decimales === 0 ? (Number.isInteger(n) ? n : undefined) : Number(n.toFixed(campo.decimales));
}

export function mensajeRango(campo: CampoAjuste<string>, min = campo.min, max = campo.max): string {
  const u = campo.unidad ? ` ${campo.unidad}` : "";
  return `${campo.etiqueta} debe estar entre ${textoNumero(min)} y ${textoNumero(max)}${u}.`;
}

// ───────────────────────── Cómo usa la app los ajustes ─────────────────────────

/** Valores de referencia del peso mínimo de servicio cuando la finca no definió el peso de su hembra adulta. */
export const PESO_MIN_SERVICIO_REFERENCIA: Record<Especie, number> = { caprino: 30, ovino: 35 };

/** Lo que se propone al armar una temporada de monta, por especie: edad, peso y condición corporal mínimos del primer servicio de la finca. */
export function criteriosServicio(a: AjustesCompletos): Record<Especie, { edadMeses: number; pesoKg: number; cc: number }> {
  const de = (e: Especie) => ({ edadMeses: a.general.servicio_edad_min_meses, pesoKg: pesoMinimoServicio(e, a), cc: a.general.servicio_cc_min });
  return { caprino: de("caprino"), ovino: de("ovino") };
}

/** Peso mínimo (kg) para el primer servicio: el porcentaje del peso adulto de la finca o, si no lo definió, el de referencia. */
export function pesoMinimoServicio(especie: Especie, a: AjustesCompletos): number {
  const adulto = a.especie[especie].peso_adulto_hembra_kg;
  return adulto == null ? PESO_MIN_SERVICIO_REFERENCIA[especie] : Math.round(((adulto * a.general.servicio_peso_adulto_pct) / 100) * 10) / 10;
}

/** Un plazo en días, dicho como lo diría una persona: 182 → «6 meses», 45 → «45 días». */
export function textoPlazo(dias: number): string {
  if (dias < 60) return `${dias} ${dias === 1 ? "día" : "días"}`;
  return `${Math.round(dias / 30.4)} meses`;
}

/** El mes (1 a 12) de una fecha «AAAA-MM-DD». */
export const mesDeFecha = (iso: string) => Number(iso.slice(5, 7));

/** Cada cuántos días toca el baño de patas en este mes (1 a 12): en meses de lluvia, el intervalo corto. */
export function diasEntrePediluvios(a: AjustesFinca, mes: number): number {
  return a.meses_lluvia.includes(mes) ? a.pediluvio_dias_lluvia : a.pediluvio_dias;
}

/** La especie de una finca que tiene una sola; con las dos no se puede decir de quién es una muestra del tanque. */
export const especieUnica = (especies: Especie[]): Especie | null => (especies.length === 1 ? especies[0] : null);

/** Un valor contra su rango (grasa, proteína): fuera del rango se avisa; sin rango definido no se juzga. */
export function estadoEnRango(valor: number, min: number | null, max: number | null): "bajo" | "alto" | "ok" | null {
  if (min == null && max == null) return null;
  if (min != null && valor < min) return "bajo";
  if (max != null && valor > max) return "alto";
  return "ok";
}
