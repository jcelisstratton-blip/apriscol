/**
 * Qué entrada del menú lateral se marca para una ruta: la más específica que coincida. En /hato/endogamia es «Endogamia», no «Hato»;
 * en /mas/miembros es «Equipo», no «Cuenta». Registrar o corregir un premio es de un animal, así que ahí se marca «Hato».
 */
export function entradaMarcada(ruta: string, hrefs: string[]): string | undefined {
  const efectiva = ruta.startsWith("/ferias/participacion") ? "/hato" : ruta;
  const coincide = (href: string) => (href === "/" ? efectiva === "/" : efectiva === href || efectiva.startsWith(`${href}/`));
  return hrefs.filter(coincide).sort((a, b) => b.length - a.length)[0];
}
