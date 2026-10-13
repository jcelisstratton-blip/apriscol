/** Planes de Apriscol: de menor a mayor. Se cobra por los servicios que incluye cada plan, nunca por número de animales. Precios en pesos colombianos por mes; el anual descuenta 20 %. */
import type { ModuloApp, PlanId } from "@/lib/tipos";

export type Plan = {
  id: PlanId;
  nombre: string;
  para: string;
  /** Pesos por mes pagando cada mes. */
  mensual: number;
  recomendado?: boolean;
  /** Lo que define al plan, en negrita arriba de la lista. */
  destacados: string[];
  /** Si el plan incluye todo lo del anterior. */
  incluyeDe?: string;
  funciones: string[];
};

export const DESCUENTO_ANUAL = 0.2;

export const PLANES: Plan[] = [
  {
    id: "cria",
    nombre: "Cría",
    para: "Para empezar ordenado: el manejo diario de tu aprisco.",
    mensual: 29900,
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
    para: "Para el criador que trabaja con equipo, corrales, monta y cuentas.",
    mensual: 59900,
    recomendado: true,
    destacados: ["Animales sin límite", "Equipo con roles: ordeñador, veterinario y contador"],
    incluyeDe: "Cría",
    funciones: [
      "Corrales y potreros con rotación y cuarentena",
      "Temporada de monta (empadronamiento)",
      "Programas sanitarios, FAMACHA y pediluvio",
      "Carne y ceba: pesos, lotes y alimento",
      "Premios y ferias, y simulador de cruzas",
      "Gastos y costo por litro",
    ],
  },
  {
    id: "profesional",
    nombre: "Profesional",
    para: "Para quien quiere reportes en Excel, costo por animal y control de calidad.",
    mensual: 119900,
    destacados: ["Animales sin límite", "Reportes y costos al detalle"],
    incluyeDe: "Hato",
    funciones: [
      "Reportes de costos en Excel con las fechas que elijas",
      "Costo por animal, por lote y por especie",
      "Controles de calidad con constancia (leche y carne)",
      "Soportes de gastos: facturas en PDF o foto",
    ],
  },
  {
    id: "hacienda",
    nombre: "Hacienda",
    para: "Para quien maneja más de una finca y quiere acompañamiento.",
    mensual: 249900,
    destacados: ["Animales sin límite", "Varias fincas en una sola cuenta"],
    incluyeDe: "Profesional",
    funciones: ["Soporte prioritario", "Acompañamiento para cargar tu información inicial"],
  },
];

/** Precio mensual que se muestra: con el descuento anual, redondeado a la centena. */
export const precioMes = (p: Plan, anual: boolean) => (anual ? Math.round((p.mensual * (1 - DESCUENTO_ANUAL)) / 100) * 100 : p.mensual);

const PLAN_POR_ID = Object.fromEntries(PLANES.map((p) => [p.id, p])) as Record<PlanId, Plan>;
export const planPorId = (id: PlanId): Plan => PLAN_POR_ID[id];
export const nombrePlan = (id: PlanId) => PLAN_POR_ID[id].nombre;

/** Orden de menor a mayor: 1 Cría, 2 Hato, 3 Profesional, 4 Hacienda. Espejo de private.plan_rango en la base. */
export const rangoPlan = (id: PlanId): number => PLANES.findIndex((p) => p.id === id) + 1;

/** Planes a los que se puede pasar desde el actual: solo hacia adelante. */
export const planesSuperiores = (actual: PlanId): Plan[] => PLANES.filter((p) => rangoPlan(p.id) > rangoPlan(actual));

/** Desde qué plan se incluye cada módulo. Espejo de private.modulo_rango; la autoridad real es la base (RLS). */
export function moduloEnPlan(plan: PlanId, modulo: ModuloApp): boolean {
  const desde = ["corrales", "carne", "ferias", "contabilidad", "nutricion", "ambiente"].includes(modulo) ? 2 : 1;
  return rangoPlan(plan) >= desde;
}

/** Servicios que se piden dentro de un módulo (la pantalla los cierra; la base cierra los módulos completos). */
export const SERVICIOS_PLAN = {
  equipo: { desde: "hato", nombre: "Equipo con roles" },
  reportes: { desde: "profesional", nombre: "Reportes de costos en Excel" },
  costoAnimal: { desde: "profesional", nombre: "Costo por animal, lote y especie" },
  calidad: { desde: "profesional", nombre: "Controles de calidad con constancia" },
  soportes: { desde: "profesional", nombre: "Soportes de gastos (facturas)" },
  fincas: { desde: "hacienda", nombre: "Varias fincas" },
} as const satisfies Record<string, { desde: PlanId; nombre: string }>;
export type ServicioPlan = keyof typeof SERVICIOS_PLAN;

export const servicioEnPlan = (plan: PlanId, servicio: ServicioPlan): boolean => rangoPlan(plan) >= rangoPlan(SERVICIOS_PLAN[servicio].desde);
