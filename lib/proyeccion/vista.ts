import type { Bloque, Mes } from "@/lib/proyeccion/motor";

/** Qué parte del negocio se mira: todo junto, solo la carne o solo la leche. */
export type Enfoque = "todo" | "carne" | "leche";
export const ENFOQUES: Enfoque[] = ["todo", "carne", "leche"];
export const esEnfoque = (v: unknown): v is Enfoque => ENFOQUES.includes(v as Enfoque);

export type Formato = "n0" | "n1" | "pesos" | "ton";

const nf = (d: number) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const FORMATOS: Record<Formato, Intl.NumberFormat> = { n0: nf(0), n1: nf(1), pesos: nf(0), ton: nf(2) };

/** Un número como se lee en Colombia: punto de miles, coma decimal. El dinero lleva «$» y los negativos, el signo delante. */
export function formatear(f: Formato, n: number): string {
  const v = Math.abs(n) < 0.5 && f === "pesos" ? 0 : n;
  const texto = FORMATOS[f].format(Math.abs(v));
  const signo = v < 0 && Number(texto.replace(/\./g, "").replace(",", ".")) !== 0 ? "−" : "";
  return f === "pesos" ? `${signo}$ ${texto}` : f === "ton" ? `${signo}${texto} t` : `${signo}${texto}`;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** El mes calendario de la proyección: el mes 1 es el que viene después del de `hoy` (AAAA-MM-DD). */
export function etiquetaMes(hoy: string, n: number): string {
  const [a, m] = hoy.split("-").map(Number);
  const indice = m - 1 + n;
  return `${MESES_CORTOS[((indice % 12) + 12) % 12]} ${a + Math.floor(indice / 12)}`;
}

export type ColumnaMes = { clave: string; titulo: string; formato: Formato; valor: (m: Mes) => number; /** Si la columna se suma en un total (flujos) o no (existencias). */ suma: boolean };

const c = (clave: string, titulo: string, formato: Formato, valor: (m: Mes) => number, suma = false): ColumnaMes => ({ clave, titulo, formato, valor, suma });

export function columnasHato(e: Enfoque): ColumnaMes[] {
  const hato = [c("vientres", "Reproductoras", "n0", (m) => m.vientres), c("crias", "Crías", "n0", (m) => m.crias), c("levante", "Levante y ceba", "n0", (m) => m.levante), c("total", "Total de animales", "n0", (m) => m.total)];
  if (e === "leche") return [c("vientres", "Reproductoras", "n0", (m) => m.vientres), c("lactantes", "En lactancia", "n0", (m) => m.lactantes), c("partos", "Partos del mes", "n1", (m) => m.partos, true), c("litros", "Litros del mes", "n0", (m) => m.litros, true)];
  if (e === "carne") return [...hato, c("nacimientos", "Nacen", "n1", (m) => m.nacimientos, true), c("ventas", "Se venden", "n1", (m) => m.ventasAnimales, true), c("kg", "Kilos vendidos", "n0", (m) => m.kgVendidos, true)];
  return [...hato, c("nacimientos", "Nacen", "n1", (m) => m.nacimientos, true), c("muertes", "Mueren", "n1", (m) => m.muertes, true), c("ventas", "Se venden", "n1", (m) => m.ventasAnimales, true)];
}

export function columnasAlimento(e: Enfoque): ColumnaMes[] {
  if (e === "leche") return [c("msLactancia", "Alimento extra por lactancia", "ton", (m) => m.msLactancia, true), c("costo", "Costo de ese alimento", "pesos", (m) => m.costoAlimentoLactancia, true)];
  if (e === "carne") return [c("msCeba", "Alimento de crías y levante", "ton", (m) => m.msLevanteYCrias, true), c("costo", "Costo de ese alimento", "pesos", (m) => m.costoAlimentoCeba, true)];
  return [c("ms", "Alimento total", "ton", (m) => m.msTotal, true), c("msCeba", "De crías y levante", "ton", (m) => m.msLevanteYCrias, true), c("msLact", "Extra por lactancia", "ton", (m) => m.msLactancia, true), c("costo", "Costo del alimento", "pesos", (m) => m.costoAlimento, true)];
}

export function columnasDinero(e: Enfoque): ColumnaMes[] {
  if (e === "leche") return [c("ing", "Ingresos por leche", "pesos", (m) => m.ingresosLeche, true), c("ali", "Alimento extra por lactancia", "pesos", (m) => m.costoAlimentoLactancia, true), c("mar", "Ingresos menos ese alimento", "pesos", (m) => m.ingresosLeche - m.costoAlimentoLactancia, true)];
  if (e === "carne") return [c("ing", "Ingresos por carne", "pesos", (m) => m.ingresosCarne, true), c("ali", "Alimento de crías y levante", "pesos", (m) => m.costoAlimentoCeba, true), c("mar", "Ingresos menos ese alimento", "pesos", (m) => m.ingresosCarne - m.costoAlimentoCeba, true)];
  return [
    c("carne", "Ingresos por carne", "pesos", (m) => m.ingresosCarne, true),
    c("leche", "Ingresos por leche", "pesos", (m) => m.ingresosLeche, true),
    c("ali", "Alimento", "pesos", (m) => m.costoAlimento, true),
    c("ani", "Sanidad y reproducción", "pesos", (m) => m.costoAnimales, true),
    c("fij", "Costos fijos", "pesos", (m) => m.costoFijos, true),
    c("flujo", "Queda en el mes", "pesos", (m) => m.flujo, true),
  ];
}

export type LineaResumen = { titulo: string; formato: Formato; valor: (b: Bloque) => number; destacada?: boolean };

/** Las cifras de cada año en la pantalla de resumen. */
export function lineasResumen(e: Enfoque): LineaResumen[] {
  const l = (titulo: string, formato: Formato, valor: (b: Bloque) => number, destacada = false): LineaResumen => ({ titulo, formato, valor, destacada });
  if (e === "leche") {
    return [
      l("Litros de leche", "n0", (b) => b.litros),
      l("Ingresos por leche", "pesos", (b) => b.ingresosLeche),
      l("Alimento extra por lactancia", "pesos", (b) => b.costoAlimentoLactancia),
      l("Ingresos menos el alimento extra de lactancia", "pesos", (b) => b.ingresosLeche - b.costoAlimentoLactancia, true),
      l("Reproductoras al final", "n0", (b) => b.vientres),
    ];
  }
  if (e === "carne") {
    return [
      l("Animales que nacen", "n0", (b) => b.nacimientos),
      l("Animales vendidos", "n0", (b) => b.ventasAnimales),
      l("Kilos vendidos", "n0", (b) => b.kgVendidos),
      l("Ingresos por carne", "pesos", (b) => b.ingresosCarne),
      l("Alimento de crías y levante", "pesos", (b) => b.costoAlimentoCeba),
      l("Ingresos menos el alimento de crías y levante", "pesos", (b) => b.ingresosCarne - b.costoAlimentoCeba, true),
    ];
  }
  return [
    l("Animales que nacen", "n0", (b) => b.nacimientos),
    l("Animales vendidos", "n0", (b) => b.ventasAnimales),
    l("Ingresos por carne", "pesos", (b) => b.ingresosCarne),
    l("Ingresos por leche", "pesos", (b) => b.ingresosLeche),
    l("Alimento", "pesos", (b) => b.costoAlimento),
    l("Sanidad, reproducción y costos fijos", "pesos", (b) => b.costoAnimales + b.costoFijos),
    l("Queda en el año", "pesos", (b) => b.flujo, true),
    l("Animales al final", "n0", (b) => b.total),
  ];
}

export const NOTA_ENFOQUE: Record<Enfoque, string | null> = {
  todo: null,
  carne: "Esta vista no resta el alimento base de las reproductoras y los sementales, ni la sanidad, ni los costos fijos: sirven a la carne y a la leche a la vez y no se reparten. Solo se compara la carne con el alimento de crías y levante. El resultado completo de la finca está en «Todo».",
  leche: "Esta vista no resta el alimento base de las reproductoras y los sementales, ni la sanidad, ni los costos fijos: sirven a la carne y a la leche a la vez y no se reparten. Solo se compara la leche con el alimento extra que pide la lactancia. El resultado completo de la finca está en «Todo».",
};

/** Lo que una vista de carne o de leche deja sin restar (los costos compartidos) y el resultado completo del mismo periodo; nulo en «Todo». */
export function costosSinRestar(b: Pick<Bloque, "costos" | "costoAlimentoCeba" | "costoAlimentoLactancia" | "flujo">, e: Enfoque): { sinRestar: number; resultadoCompleto: number } | null {
  if (e === "todo") return null;
  return { sinRestar: b.costos - (e === "carne" ? b.costoAlimentoCeba : b.costoAlimentoLactancia), resultadoCompleto: b.flujo };
}
