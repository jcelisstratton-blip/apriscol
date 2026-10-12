/**
 * Lee un número escrito a la colombiana: coma decimal («3,6») y punto de miles («2.500», «1.250.000»). Un punto que no separa miles
 * de a tres cifras («3.6») se toma como decimal. Devuelve null si no es un número.
 */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(/[\s$]/g, "");
  if (t === "") return null;
  const normal = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}
