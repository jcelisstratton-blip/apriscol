import type { DestinoGasto, OrigenCosto, RubroCosto, RubroGasto } from "@/lib/tipos";

/** Los grupos de gasto (el documento «Componentes de gastos del aprisco») y los rubros de cada uno. */
export type GrupoGasto = "alimentacion" | "sanidad" | "reproduccion" | "logistica" | "operacion";
export const GRUPOS: GrupoGasto[] = ["alimentacion", "sanidad", "reproduccion", "logistica", "operacion"];
export const ETIQUETA_GRUPO: Record<GrupoGasto, string> = {
  alimentacion: "Alimentación",
  sanidad: "Sanidad",
  reproduccion: "Reproducción",
  logistica: "Identificación y transporte",
  operacion: "Operación de la finca",
};
/** Qué incluye cada grupo, en una línea. */
export const DETALLE_GRUPO: Record<GrupoGasto, string> = {
  alimentacion: "Concentrado, forraje, sales y leche maternizada",
  sanidad: "Vacunas, tratamientos, pruebas y podología",
  reproduccion: "Pajillas, hormonas y asistencia veterinaria",
  logistica: "Aretes, microchips y fletes",
  operacion: "Mano de obra, arriendo, servicios y mantenimiento",
};
export const RUBROS_DE: Record<GrupoGasto, RubroGasto[]> = {
  alimentacion: ["concentrado", "forraje", "sales_suplementos", "leche_maternizada"],
  sanidad: ["vacunas_desparasitantes", "tratamientos", "pruebas_laboratorio", "podologia", "bioseguridad"],
  reproduccion: ["material_reproductivo", "asistencia_veterinaria"],
  logistica: ["identificacion", "fletes"],
  operacion: ["mano_obra", "arriendo", "servicios_publicos", "combustible", "mantenimiento", "otros"],
};
export const RUBROS: RubroGasto[] = GRUPOS.flatMap((g) => RUBROS_DE[g]);
export const GRUPO_DE: Record<RubroGasto, GrupoGasto> = Object.fromEntries(GRUPOS.flatMap((g) => RUBROS_DE[g].map((r) => [r, g]))) as Record<RubroGasto, GrupoGasto>;

/**
 * Los grupos con que se REPORTA el costo: los cinco de arriba (en los que se registra una compra) más la mano de obra y la compra de animales,
 * que se separan porque no son compras de insumos: la mano de obra es de la nómina y la compra de un animal sale de su ficha.
 */
export type GrupoCosto = GrupoGasto | "personal" | "animales";
export const GRUPOS_COSTO: GrupoCosto[] = [...GRUPOS, "personal", "animales"];
export const ETIQUETA_GRUPO_COSTO: Record<GrupoCosto, string> = { ...ETIQUETA_GRUPO, personal: "Mano de obra", animales: "Compra de animales" };
export const DETALLE_GRUPO_COSTO: Record<GrupoCosto, string> = { ...DETALLE_GRUPO, personal: "Jornales, salarios y honorarios", animales: "Lo que costaron los animales comprados" };
/** El grupo de un rubro al reportar (misma regla que `private.grupo_rubro` en la base). */
export const grupoDe = (rubro: RubroCosto): GrupoCosto => (rubro === "mano_obra" ? "personal" : rubro === "compra_animales" ? "animales" : GRUPO_DE[rubro]);

export const ETIQUETA_RUBRO: Record<RubroCosto, string> = {
  compra_animales: "Compra de animales",
  concentrado: "Concentrado",
  forraje: "Forrajes y heno",
  sales_suplementos: "Sales y suplementos",
  leche_maternizada: "Leche maternizada",
  vacunas_desparasitantes: "Vacunas y desparasitantes",
  tratamientos: "Tratamientos y fármacos",
  pruebas_laboratorio: "Pruebas de laboratorio",
  podologia: "Podología y pediluvio",
  bioseguridad: "Bioseguridad y desinfección",
  material_reproductivo: "Material reproductivo",
  asistencia_veterinaria: "Asistencia veterinaria",
  identificacion: "Identificación",
  fletes: "Fletes y transporte",
  mano_obra: "Mano de obra",
  arriendo: "Arriendo",
  servicios_publicos: "Agua y energía",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  otros: "Otros gastos",
};
/** Una unidad habitual para la cantidad de cada rubro (se propone, se puede cambiar). */
export const UNIDAD_SUGERIDA: Partial<Record<RubroGasto, string>> = {
  concentrado: "bultos",
  forraje: "pacas",
  sales_suplementos: "kg",
  leche_maternizada: "kg",
  vacunas_desparasitantes: "dosis",
  material_reproductivo: "pajillas",
  identificacion: "aretes",
  combustible: "galones",
};
export const UNIDADES_GASTO = ["bultos", "kg", "toneladas", "pacas", "litros", "galones", "dosis", "pajillas", "aretes", "jornales", "horas", "visitas", "viajes", "meses", "animales", "unidades"];

export const DESTINOS: DestinoGasto[] = ["finca", "especie", "ubicacion", "lote", "animal"];
export const ETIQUETA_DESTINO: Record<DestinoGasto, string> = {
  finca: "Toda la finca",
  especie: "Una especie",
  ubicacion: "Un corral o potrero",
  lote: "Un lote de ceba",
  animal: "Un animal",
};
export const DETALLE_DESTINO: Record<DestinoGasto, string> = {
  finca: "Gastos generales, sin repartir",
  especie: "Se reparte entre cabras u ovejas",
  ubicacion: "Se reparte entre los que estaban ahí",
  lote: "Se reparte entre los del lote",
  animal: "Se suma a su costo",
};

export const ETIQUETA_ORIGEN: Record<OrigenCosto, string> = { gasto: "Compra", sanidad: "Sanidad", ceba: "Ceba", compra: "Compra de animal", nomina: "Nómina" };

/** Cómo se paga un gasto: ya se pagó, o queda por pagar con su fecha de vencimiento. */
export type EstadoPago = "pagado" | "por_pagar";
export const ETIQUETA_PAGO: Record<EstadoPago, string> = { pagado: "Ya se pagó", por_pagar: "Queda por pagar" };

/** Un gasto «por pagar» está vencido si su fecha de vencimiento ya pasó. */
export const estaVencido = (g: { pagado_en?: string | null; pagado?: boolean; vence: string | null }, hoy: string) =>
  !(g.pagado_en ?? g.pagado) && g.vence !== null && g.vence < hoy;

/** Cuánto pesa la alimentación en el total: la guía habla de 60 % a 70 % de los egresos. */
export const ALIMENTACION_HABITUAL = { min: 60, max: 70 };

export const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);
