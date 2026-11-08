/**
 * La moneda de cada finca (columna `fincas.moneda`, código ISO 4217; de fábrica COP). Todo el dinero de la app (compras, ventas, costos, reportes,
 * Excel) se escribe con `dinero(valor, moneda)`: una sola definición. Los componentes de cliente la reciben por contexto (`useDinero`,
 * `components/ProveedorMoneda.tsx`) y los de servidor la leen de `finca.moneda`.
 *
 * Cambiar la moneda de una finca **no convierte** ningún valor guardado: solo cambia cómo se escribe. Es para quien opera en otro país, no un cambio de divisas.
 * La facturación de Apriscol (planes, Nequi) es aparte y sigue en pesos colombianos (`lib/pago-manual.ts`).
 */

export type Moneda = {
  codigo: string;
  nombre: string;
  /** Símbolo corto para etiquetas de campos («$», «S/», «R$», «€»). */
  simbolo: string;
  /** Cómo se agrupan los miles y se escribe el decimal en ese país. */
  locale: string;
  /** Cifras decimales que se muestran (el peso colombiano, el chileno y el guaraní no usan centavos). */
  decimales: 0 | 2;
  /** Países donde se usa, para elegirla sin saber el código. */
  paises: string;
};

export const MONEDA_DEFECTO = "COP";

export const MONEDAS: Moneda[] = [
  { codigo: "COP", nombre: "Peso colombiano", simbolo: "$", locale: "es-CO", decimales: 0, paises: "Colombia" },
  { codigo: "USD", nombre: "Dólar estadounidense", simbolo: "US$", locale: "es-EC", decimales: 2, paises: "Ecuador, El Salvador, Panamá, Estados Unidos" },
  { codigo: "MXN", nombre: "Peso mexicano", simbolo: "$", locale: "es-MX", decimales: 2, paises: "México" },
  { codigo: "PEN", nombre: "Sol peruano", simbolo: "S/", locale: "es-PE", decimales: 2, paises: "Perú" },
  { codigo: "CLP", nombre: "Peso chileno", simbolo: "$", locale: "es-CL", decimales: 0, paises: "Chile" },
  { codigo: "ARS", nombre: "Peso argentino", simbolo: "$", locale: "es-AR", decimales: 2, paises: "Argentina" },
  { codigo: "UYU", nombre: "Peso uruguayo", simbolo: "$U", locale: "es-UY", decimales: 2, paises: "Uruguay" },
  { codigo: "PYG", nombre: "Guaraní paraguayo", simbolo: "₲", locale: "es-PY", decimales: 0, paises: "Paraguay" },
  { codigo: "BOB", nombre: "Boliviano", simbolo: "Bs", locale: "es-BO", decimales: 2, paises: "Bolivia" },
  { codigo: "BRL", nombre: "Real brasileño", simbolo: "R$", locale: "pt-BR", decimales: 2, paises: "Brasil" },
  { codigo: "CRC", nombre: "Colón costarricense", simbolo: "₡", locale: "es-CR", decimales: 0, paises: "Costa Rica" },
  { codigo: "GTQ", nombre: "Quetzal", simbolo: "Q", locale: "es-GT", decimales: 2, paises: "Guatemala" },
  { codigo: "HNL", nombre: "Lempira", simbolo: "L", locale: "es-HN", decimales: 2, paises: "Honduras" },
  { codigo: "NIO", nombre: "Córdoba nicaragüense", simbolo: "C$", locale: "es-NI", decimales: 2, paises: "Nicaragua" },
  { codigo: "DOP", nombre: "Peso dominicano", simbolo: "RD$", locale: "es-DO", decimales: 2, paises: "República Dominicana" },
  { codigo: "EUR", nombre: "Euro", simbolo: "€", locale: "es-ES", decimales: 2, paises: "España, Portugal y el resto de la zona euro" },
];

const POR_CODIGO = new Map(MONEDAS.map((m) => [m.codigo, m]));

/** La moneda de un código; uno desconocido cae en la de fábrica para no romper ninguna pantalla. */
export const monedaDe = (codigo: string | null | undefined): Moneda => POR_CODIGO.get(codigo ?? "") ?? POR_CODIGO.get(MONEDA_DEFECTO)!;

export const esMonedaValida = (codigo: string): boolean => POR_CODIGO.has(codigo);

const formateadores = new Map<string, Intl.NumberFormat>();
function formateador(m: Moneda): Intl.NumberFormat {
  let f = formateadores.get(m.codigo);
  if (!f) {
    f = new Intl.NumberFormat(m.locale, { style: "currency", currency: m.codigo, minimumFractionDigits: m.decimales, maximumFractionDigits: m.decimales });
    formateadores.set(m.codigo, f);
  }
  return f;
}

/**
 * Un valor en la moneda de la finca («$ 1.250.000», «S/ 1.250,50»). Sin valor escribe 0, o `vacio` si se pasa (por ejemplo «—»).
 */
export function dinero(n: number | null | undefined, moneda: string | null | undefined = MONEDA_DEFECTO, vacio?: string): string {
  if (n == null && vacio !== undefined) return vacio;
  return formateador(monedaDe(moneda)).format(n ?? 0);
}

/** Solo el número, con el separador del país y sin símbolo (para tablas y Excel donde la moneda ya se dice en el título). */
export function cifraDinero(n: number, moneda: string | null | undefined = MONEDA_DEFECTO): string {
  const m = monedaDe(moneda);
  return new Intl.NumberFormat(m.locale, { minimumFractionDigits: m.decimales, maximumFractionDigits: m.decimales }).format(n);
}

/** El formato de número de Excel con el símbolo de la moneda: `"$" #,##0` o `"S/" #,##0.00`. Los negativos van en rojo. */
export function formatoExcelDinero(moneda: string | null | undefined = MONEDA_DEFECTO): string {
  const m = monedaDe(moneda);
  const n = m.decimales === 0 ? "#,##0" : "#,##0.00";
  return `"${m.simbolo}" ${n};[Red]-"${m.simbolo}" ${n}`;
}
