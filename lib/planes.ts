/** Planes de Apriscol: de menor a mayor. Precios en pesos colombianos por mes; el anual descuenta 20 %. */
export type Plan = {
  id: string;
  nombre: string;
  para: string;
  /** Pesos por mes pagando cada mes. */
  mensual: number;
  recomendado?: boolean;
  /** Límites del plan: fincas, animales activos y usuarios. */
  limites: string[];
  /** Si el plan incluye todo lo del anterior. */
  incluyeDe?: string;
  funciones: string[];
};

export const DESCUENTO_ANUAL = 0.2;

export const PLANES: Plan[] = [
  {
    id: "cria",
    nombre: "Cría",
    para: "Para empezar ordenado: un aprisco pequeño y tú.",
    mensual: 29900,
    limites: ["1 finca", "Hasta 30 animales activos", "2 usuarios (tú y 1 más)"],
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
    para: "Para el criador que ya maneja corrales, monta y cuentas.",
    mensual: 59900,
    recomendado: true,
    limites: ["1 finca", "Hasta 100 animales activos", "4 usuarios con roles"],
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
    id: "majada",
    nombre: "Majada",
    para: "Para quien necesita reportes y manejar varias fincas.",
    mensual: 119900,
    limites: ["3 fincas", "Hasta 300 animales activos", "8 usuarios con roles"],
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
    para: "Para grandes hatos y empresas con equipo propio.",
    mensual: 249900,
    limites: ["10 fincas", "Hasta 1.000 animales activos", "20 usuarios con roles"],
    incluyeDe: "Majada",
    funciones: ["Soporte prioritario", "Acompañamiento para cargar tu información inicial"],
  },
];

/** Precio mensual que se muestra: con el descuento anual, redondeado a la centena. */
export const precioMes = (p: Plan, anual: boolean) => (anual ? Math.round((p.mensual * (1 - DESCUENTO_ANUAL)) / 100) * 100 : p.mensual);
