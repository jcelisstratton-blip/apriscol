/** Planes de Apriscol: de menor a mayor. Se cobra por los servicios que incluye cada plan, nunca por número de animales. Precios en pesos colombianos por mes; el anual descuenta 20 %. */
export type Plan = {
  id: string;
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
    id: "majada",
    nombre: "Majada",
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
    incluyeDe: "Majada",
    funciones: ["Soporte prioritario", "Acompañamiento para cargar tu información inicial"],
  },
];

/** Precio mensual que se muestra: con el descuento anual, redondeado a la centena. */
export const precioMes = (p: Plan, anual: boolean) => (anual ? Math.round((p.mensual * (1 - DESCUENTO_ANUAL)) / 100) * 100 : p.mensual);
