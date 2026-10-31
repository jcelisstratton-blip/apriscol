/**
 * Unidades de medida de lo que se compra, se vende o se da de comer («bultos», «litros», «dosis», «animales»…): cómo se escribe cada una en singular, para los textos
 * «Precio de cada litro», «Por galón», «¿Cuántos kg pesa cada bulto?». Quitar la «s» a ciegas dejaba «animale», «dosi», «galone», «mese» o «jornale».
 */

/** Las que no siguen la regla general: las que ya vienen con su singular y las que cambian de forma. */
const SINGULARES: Record<string, string> = {
  kg: "kg",
  g: "g",
  ml: "ml",
  cc: "cc",
  mg: "mg",
  dosis: "dosis",
  meses: "mes",
  galones: "galón",
  animales: "animal",
  jornales: "jornal",
  unidades: "unidad",
};

/** El singular de una unidad de medida o de compra: «bultos» → «bulto», «galones» → «galón», «dosis» → «dosis». Lo que no reconoce lo deja como viene. */
export function singular(palabra: string): string {
  const p = palabra.trim();
  const clave = p.toLowerCase();
  if (Object.hasOwn(SINGULARES, clave)) return SINGULARES[clave];
  if (/ones$/i.test(p)) return `${p.slice(0, -4)}ón`;
  if (/[lrdnz]es$/i.test(p)) return p.slice(0, -2); // animales, jornales, unidades, colores
  if (/[^i][aeiou]s$/i.test(p)) return p.slice(0, -1); // bultos, pacas, viajes, aretes, dosis (la «is» no entra)
  return p;
}

/** «Precio de cada litro»: el texto del campo del precio por unidad. */
export const precioDeCada = (unidad: string | null | undefined): string => `Precio de cada ${unidad ? singular(unidad) : "unidad"}`;

/** «Por litro»: el detalle de un producto en las tarjetas. `undefined` si el producto no tiene unidad. */
export const textoPorUnidad = (unidad: string | null | undefined): string | undefined => (unidad ? `Por ${singular(unidad)}` : undefined);
