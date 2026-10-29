/**
 * Inventario de alimento (concentrado, forraje, sales y suplementos, leche maternizada). Todo se cuenta en kg: lo que se compra en bultos o pacas se pasa a kg con
 * el peso de cada unidad, y lo que se da de comer se anota en kg. Las existencias las calcula la base (`inventario_alimento`); aquí viven las reglas puras que las
 * interpretan —autonomía en días, estado, textos—, para que la pantalla y el semáforo digan lo mismo.
 */
import { diasDesde } from "@/lib/fechas";
import { cantidadTexto } from "@/lib/inventario";

/** Una fila de `inventario_alimento`. */
export type FilaAlimento = {
  producto_id: string;
  nombre: string;
  rubro: string;
  unidad: string | null;
  /** Cuánto pesa cada unidad en que se compra (un bulto, una paca). Sin él, lo que se compra en esa unidad no se puede sumar. */
  kg_por_unidad: number | null;
  desde: string | null;
  stock_kg: number | null;
  /** Lo que se dio de comer en los últimos 14 días, en kg. */
  consumo_kg: number;
  /** Cuántos días distintos tuvieron salidas en esos 14 días. */
  dias_con_salida: number;
  compras_sin_calcular: number;
};

/** Los rubros de compra que cuentan como alimento. Espejo de `public.inventario_alimento`. */
export const RUBROS_ALIMENTO = ["concentrado", "forraje", "sales_suplementos", "leche_maternizada"] as const;

/** Días hacia atrás con que se mide cuánto se consume por día. */
export const DIAS_VENTANA_CONSUMO = 14;
/** Con menos días con salidas que estos, la app no calcula la autonomía: no inventa una cifra. */
export const MIN_DIAS_CON_SALIDA = 3;

/** ¿Un kg es la unidad de compra? Entonces no hace falta el peso por unidad. */
export const compraEnKg = (unidad: string | null): boolean => (unidad ?? "").trim().toLowerCase() === "kg";

/** Falta definir cuánto pesa cada unidad: sin eso las compras no se pueden sumar. */
export const faltaPeso = (f: Pick<FilaAlimento, "unidad" | "kg_por_unidad">): boolean => !compraEnKg(f.unidad) && f.kg_por_unidad === null;

/** Lo que se da por día, en kg, según los últimos 14 días (o los que lleva contando, si son menos). Nulo si todavía hay pocos días con salidas. */
export function consumoDiarioKg(f: Pick<FilaAlimento, "desde" | "consumo_kg" | "dias_con_salida">, hoy: string): number | null {
  if (!f.desde || f.dias_con_salida < MIN_DIAS_CON_SALIDA) return null;
  const ventana = Math.max(1, Math.min(DIAS_VENTANA_CONSUMO, diasDesde(f.desde, hoy) + 1));
  return f.consumo_kg / ventana;
}

/** Para cuántos días alcanza lo que hay, al ritmo de los últimos 14 días. Nulo si no hay con qué calcularlo. */
export function autonomiaDias(f: Pick<FilaAlimento, "desde" | "stock_kg" | "consumo_kg" | "dias_con_salida">, hoy: string): number | null {
  const consumo = consumoDiarioKg(f, hoy);
  if (consumo === null || consumo <= 0 || f.stock_kg === null || f.stock_kg <= 0) return null;
  return f.stock_kg / consumo;
}

export type EstadoAlimento = "sin_contar" | "negativo" | "agotado" | "critico" | "bajo" | "ok" | "sin_datos";
export const ETIQUETA_ESTADO_ALIMENTO: Record<EstadoAlimento, string> = {
  sin_contar: "Por contar",
  negativo: "Descuadrado",
  agotado: "Agotado",
  critico: "Se acaba pronto",
  bajo: "Alcanza poco",
  ok: "Al día",
  sin_datos: "Sin consumo registrado",
};
export const DETALLE_ESTADO_ALIMENTO: Record<EstadoAlimento, string> = {
  sin_contar: "Todavía no se ha hecho el conteo de apertura",
  negativo: "Se dio de comer más de lo que había registrado",
  agotado: "No queda nada",
  critico: "Alcanza para menos de la mitad del plazo de aviso",
  bajo: "Alcanza para menos del plazo de aviso",
  ok: "Alcanza para más del plazo de aviso",
  sin_datos: "Hay existencias, pero faltan días con salidas para calcular cuánto duran",
};

/**
 * El estado de un alimento: descuadrado o agotado; si no, según para cuántos días alcanza frente al plazo de aviso de Ajustes (`stock_autonomia_dias`):
 * menos de la mitad del plazo es «se acaba pronto» (rojo), menos del plazo, «alcanza poco» (ámbar).
 */
export function estadoAlimento(f: Pick<FilaAlimento, "desde" | "stock_kg" | "consumo_kg" | "dias_con_salida">, plazoDias: number, hoy: string): EstadoAlimento {
  if (!f.desde || f.stock_kg === null) return "sin_contar";
  if (f.stock_kg < 0) return "negativo";
  if (f.stock_kg === 0) return "agotado";
  const dias = autonomiaDias(f, hoy);
  if (dias === null) return "sin_datos";
  return dias < plazoDias / 2 ? "critico" : dias < plazoDias ? "bajo" : "ok";
}

/** ¿Pide atención? Descuadrado, agotado, o que alcanza para menos del plazo de aviso. */
export function alimentoPideAtencion(f: Pick<FilaAlimento, "desde" | "stock_kg" | "consumo_kg" | "dias_con_salida">, plazoDias: number, hoy: string): boolean {
  const e = estadoAlimento(f, plazoDias, hoy);
  return e === "negativo" || e === "agotado" || e === "critico" || e === "bajo";
}

/** «2,5 días», «1 día». */
export const diasTexto = (n: number): string => `${cantidadTexto(Math.round(n * 10) / 10)} ${Math.round(n * 10) / 10 === 1 ? "día" : "días"}`;

/** «140 kg» o, si se sabe cuánto pesa cada unidad, «140 kg · 3,5 bultos». */
export function textoKg(f: Pick<FilaAlimento, "unidad" | "kg_por_unidad">, kg: number): string {
  const base = `${cantidadTexto(kg)} kg`;
  if (compraEnKg(f.unidad) || !f.kg_por_unidad || !f.unidad) return base;
  return `${base} · ${cantidadTexto(kg / f.kg_por_unidad)} ${f.unidad}`;
}

/** En qué se puede contar o anotar: siempre en kg, y también en la unidad de compra (bultos, pacas) si se sabe cuánto pesa. `factor` pasa lo escrito a kg. */
export function unidadesDeCantidad(f: Pick<FilaAlimento, "unidad" | "kg_por_unidad">): { valor: string; nombre: string; factor: number }[] {
  const kg = { valor: "kg", nombre: "kg", factor: 1 };
  return compraEnKg(f.unidad) || !f.kg_por_unidad || !f.unidad ? [kg] : [kg, { valor: "unidad", nombre: f.unidad, factor: f.kg_por_unidad }];
}

/** «bultos» → «bulto», «pacas» → «paca», «unidades» → «unidad». */
export const singular = (palabra: string): string => (/ades$/i.test(palabra) ? palabra.slice(0, -2) : /[aeiou]s$/i.test(palabra) ? palabra.slice(0, -1) : palabra);

/** Redondea a los 2 decimales con que se guarda. */
export const aKg = (cantidad: number, factor: number): number => Math.round(cantidad * factor * 100) / 100;

export type MotivoAjusteAlimento = "conteo" | "perdida" | "dano" | "otro";
export const MOTIVOS_AJUSTE_ALIMENTO: MotivoAjusteAlimento[] = ["conteo", "perdida", "dano", "otro"];
