/** Planes de Apriscol: de menor a mayor. Se cobra por los servicios que incluye cada plan, nunca por número de animales. **Cada finca tiene su propio plan.** Precios en dólares (US$) por mes, siempre en dólares enteros; el anual descuenta 20 % y, desde la segunda finca, 10 % menos. */
import type { ModuloApp, PlanId } from "@/lib/tipos";

export type Plan = {
  id: PlanId;
  nombre: string;
  para: string;
  /** Dólares por mes pagando cada mes. */
  mensual: number;
  recomendado?: boolean;
  /** Lo que define al plan, en negrita arriba de la lista. */
  destacados: string[];
  /** Si el plan incluye todo lo del anterior. */
  incluyeDe?: string;
  funciones: string[];
};

export const DESCUENTO_ANUAL = 0.2;
/** Cada finca adicional (desde la segunda) paga su plan con este descuento. */
export const DESCUENTO_FINCA_ADICIONAL = 0.1;

export const PLANES: Plan[] = [
  {
    id: "cria",
    nombre: "Cría",
    para: "Para empezar ordenado: el manejo diario de tu aprisco.",
    mensual: 10,
    destacados: ["Animales sin límite", "Cabras y ovejas", "Tú, como propietario"],
    funciones: [
      "Ficha de cada animal con foto y genealogía",
      "Endogamia calculada antes de cruzar",
      "Leche: ordeño por jornada y calidad",
      "Sanidad con periodos de retiro",
      "Servicios, gestación y partos",
      "Traer tus animales del libro genealógico",
    ],
  },
  {
    id: "hato",
    nombre: "Hato",
    para: "Para el criador que trabaja con equipo, corrales y monta.",
    mensual: 18,
    recomendado: true,
    destacados: ["Animales sin límite", "Equipo con roles: ordeñador, veterinario y contador"],
    incluyeDe: "Cría",
    funciones: [
      "Corrales y potreros con rotación y cuarentena",
      "Temporada de monta (empadronamiento)",
      "Programas sanitarios, FAMACHA y pediluvio",
      "Premios y ferias, y simulador de cruzas",
    ],
  },
  {
    id: "profesional",
    nombre: "Profesional",
    para: "Para llevar tu aprisco como un negocio: cuentas, personal, carne y reportes.",
    mensual: 36,
    destacados: ["Animales sin límite", "Cuentas, personal y reportes al detalle"],
    incluyeDe: "Hato",
    funciones: [
      "Compras, ventas y lo que te deben",
      "Personal y nómina con el costo real de la mano de obra",
      "Carne y ceba: pesos, lotes y alimento",
      "Costo por litro, por animal, por lote y por especie",
      "Reportes en Excel: costos y hato, con las fechas que elijas",
      "Proyecciones a 12, 24 o 36 meses: hato, alimento y dinero (carne y leche)",
      "Controles de calidad con constancia (leche y carne)",
      "Soportes de gastos: facturas en PDF o foto",
    ],
  },
  {
    id: "hacienda",
    nombre: "Hacienda",
    para: "Para quien quiere acompañamiento y atención prioritaria.",
    mensual: 72,
    destacados: ["Animales sin límite", "Soporte prioritario"],
    incluyeDe: "Profesional",
    funciones: ["Acompañamiento para cargar tu información inicial"],
  },
];

/**
 * Precio mensual de un plan en dólares enteros. `numeroFinca` es el lugar de la finca entre las del propietario (1 = la primera, que paga el precio completo; desde la 2,
 * 10 % menos). El 20 % del pago anual se aplica sobre ese resultado y el precio final se redondea al dólar.
 */
export function precioMes(p: Plan, anual: boolean, numeroFinca = 1): number {
  const base = p.mensual * (anual ? 1 - DESCUENTO_ANUAL : 1) * (numeroFinca > 1 ? 1 - DESCUENTO_FINCA_ADICIONAL : 1);
  return Math.round(base);
}

/** «US$ 8», «US$ 6,40»: sin centavos cuando el valor es entero. */
export const usd = (n: number) => `US$ ${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;

const PLAN_POR_ID = Object.fromEntries(PLANES.map((p) => [p.id, p])) as Record<PlanId, Plan>;
export const planPorId = (id: PlanId): Plan => PLAN_POR_ID[id];
export const nombrePlan = (id: PlanId) => PLAN_POR_ID[id].nombre;

/** Orden de menor a mayor: 1 Cría, 2 Hato, 3 Profesional, 4 Hacienda. Espejo de private.plan_rango en la base. */
export const rangoPlan = (id: PlanId): number => PLANES.findIndex((p) => p.id === id) + 1;

/** Planes a los que se puede pasar desde el actual: solo hacia adelante. */
export const planesSuperiores = (actual: PlanId): Plan[] => PLANES.filter((p) => rangoPlan(p.id) > rangoPlan(actual));

/** Desde qué plan se incluye cada módulo. Espejo de private.modulo_rango; la autoridad real es la base (RLS). */
export function moduloEnPlan(plan: PlanId, modulo: ModuloApp): boolean {
  const desde = ["carne", "contabilidad", "proyecciones"].includes(modulo) ? 3 : ["corrales", "ferias", "nutricion", "ambiente", "inventario"].includes(modulo) ? 2 : 1;
  return rangoPlan(plan) >= desde;
}

/** Servicios que se piden dentro de un módulo (la pantalla los cierra; la base cierra los módulos completos). */
export const SERVICIOS_PLAN = {
  equipo: { desde: "hato", nombre: "Equipo con roles" },
  reportes: { desde: "profesional", nombre: "Reportes en Excel" },
  costoAnimal: { desde: "profesional", nombre: "Costo por animal, lote y especie" },
  calidad: { desde: "profesional", nombre: "Controles de calidad con constancia" },
  soportes: { desde: "profesional", nombre: "Soportes de gastos (facturas)" },
  proyecciones: { desde: "profesional", nombre: "Proyecciones del hato, el alimento y el dinero" },
} as const satisfies Record<string, { desde: PlanId; nombre: string }>;
export type ServicioPlan = keyof typeof SERVICIOS_PLAN;

export const servicioEnPlan = (plan: PlanId, servicio: ServicioPlan): boolean => rangoPlan(plan) >= rangoPlan(SERVICIOS_PLAN[servicio].desde);
